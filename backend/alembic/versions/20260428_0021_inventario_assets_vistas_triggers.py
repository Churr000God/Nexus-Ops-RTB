"""inventario_assets: vistas, funciones, triggers y pg_cron

Cambios:
  1. v_inventory_current    — stock actual (qty, avg_cost, status) por producto
  2. v_inventory_kpis       — ABC, días sin movimiento, semáforo, acción sugerida
  3. v_saleable_inventory   — solo productos is_saleable=TRUE
  4. v_internal_inventory   — solo productos is_saleable=FALSE
  5. v_asset_current_components — componentes vigentes por equipo
  6. v_asset_repair_history  — historial cronológico de cambios por equipo
  7. fn_on_component_install — trigger: INSTALL → crea ISSUE en inventory_movements
                               + escribe asset_component_history
  8. trg_asset_component_install — dispara fn_on_component_install en INSERT
  9. fn_remove_asset_component — función plpgsql para retirar una pieza
                                  (reutilizable → RETURN_IN | defectuosa → NC + ADJUSTMENT_OUT)
 10. fn_close_monthly_snapshot — inserta filas en inventory_snapshots
 11. pg_cron job: cierre el último día de cada mes a las 23:00

Revision ID: 20260428_0021
Revises: 20260428_0020
Create Date: 2026-04-28
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260428_0021"
down_revision: str = "20260428_0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1. v_inventory_current ──────────────────────────────────────────────────
    # Stock calculado desde inventory_movements (fuente de verdad).
    # avg_unit_cost proviene del trigger de costo promedio (productos.current_avg_cost).
    op.execute("""
        CREATE OR REPLACE VIEW v_inventory_current AS
        SELECT
            p.id                                    AS product_id,
            p.sku,
            p.name,
            p.is_saleable,
            p.category,
            COALESCE(SUM(im.qty_in),  0)
                - COALESCE(SUM(im.qty_out), 0)      AS quantity_on_hand,
            COALESCE(p.current_avg_cost, p.unit_price, 0) AS avg_unit_cost,
            (
                COALESCE(SUM(im.qty_in),  0)
                - COALESCE(SUM(im.qty_out), 0)
            ) * COALESCE(p.current_avg_cost, p.unit_price, 0) AS total_value,
            inv.min_stock,
            CASE
                WHEN COALESCE(SUM(im.qty_in), 0) - COALESCE(SUM(im.qty_out), 0) <= 0
                    THEN 'OUT'
                WHEN (
                    COALESCE(SUM(im.qty_in), 0) - COALESCE(SUM(im.qty_out), 0)
                ) < COALESCE(inv.min_stock, 0)
                    THEN 'BELOW_MIN'
                ELSE 'OK'
            END                                     AS stock_status,
            inv.last_inbound_on,
            inv.last_outbound_on
        FROM productos p
        LEFT JOIN inventory_movements im ON im.product_id = p.id
        LEFT JOIN inventario inv ON inv.product_id = p.id
        GROUP BY
            p.id, p.sku, p.name, p.is_saleable, p.category,
            p.current_avg_cost, p.unit_price,
            inv.min_stock, inv.last_inbound_on, inv.last_outbound_on;
    """)

    # ── 2. v_inventory_kpis ─────────────────────────────────────────────────────
    # ABC (A ≥ $50k / B $10k-$49k / C < $10k), días sin movimiento, semáforo
    op.execute("""
        CREATE OR REPLACE VIEW v_inventory_kpis AS
        SELECT
            vc.product_id,
            vc.sku,
            vc.name,
            vc.is_saleable,
            vc.quantity_on_hand,
            vc.avg_unit_cost,
            vc.total_value,
            vc.stock_status,
            CASE
                WHEN vc.total_value >= 50000 THEN 'A'
                WHEN vc.total_value >= 10000 THEN 'B'
                ELSE 'C'
            END AS abc_classification,
            CURRENT_DATE - COALESCE(vc.last_outbound_on, vc.last_inbound_on, CURRENT_DATE)
                AS days_without_movement,
            CASE
                WHEN CURRENT_DATE - COALESCE(vc.last_outbound_on, vc.last_inbound_on, CURRENT_DATE) <= 30
                    THEN 'ACTIVE'
                WHEN CURRENT_DATE - COALESCE(vc.last_outbound_on, vc.last_inbound_on, CURRENT_DATE) <= 90
                    THEN 'SLOW'
                WHEN CURRENT_DATE - COALESCE(vc.last_outbound_on, vc.last_inbound_on, CURRENT_DATE) <= 180
                    THEN 'DORMANT'
                WHEN CURRENT_DATE - COALESCE(vc.last_outbound_on, vc.last_inbound_on, CURRENT_DATE) <= 365
                    THEN 'INACTIVE'
                ELSE 'OBSOLETE'
            END AS aging_classification,
            CASE
                WHEN vc.stock_status = 'OUT'       THEN 'RED'
                WHEN vc.stock_status = 'BELOW_MIN' THEN 'YELLOW'
                ELSE 'GREEN'
            END AS traffic_light,
            CASE
                WHEN vc.stock_status = 'OUT'       THEN 'Reabastecer urgente'
                WHEN vc.stock_status = 'BELOW_MIN' THEN 'Solicitar material'
                WHEN CURRENT_DATE - COALESCE(vc.last_outbound_on, vc.last_inbound_on, CURRENT_DATE) > 180
                    THEN 'Revisar obsolescencia'
                ELSE 'OK'
            END AS suggested_action
        FROM v_inventory_current vc;
    """)

    # ── 3. v_saleable_inventory ─────────────────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE VIEW v_saleable_inventory AS
        SELECT * FROM v_inventory_current WHERE is_saleable = TRUE;
    """)

    # ── 4. v_internal_inventory ─────────────────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE VIEW v_internal_inventory AS
        SELECT * FROM v_inventory_current WHERE is_saleable = FALSE;
    """)

    # ── 5. v_asset_current_components ───────────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE VIEW v_asset_current_components AS
        SELECT
            a.id            AS asset_id,
            a.asset_code,
            a.name          AS asset_name,
            a.status        AS asset_status,
            ac.id           AS asset_component_id,
            p.id            AS product_id,
            p.sku           AS component_sku,
            p.name          AS component_name,
            ac.quantity,
            ac.serial_number,
            ac.installed_at,
            u.email         AS installed_by_email,
            ac.notes
        FROM assets a
        JOIN asset_components ac ON ac.asset_id = a.id
        LEFT JOIN productos p ON p.id = ac.product_id
        LEFT JOIN users u ON u.id = ac.installed_by;
    """)

    # ── 6. v_asset_repair_history ───────────────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE VIEW v_asset_repair_history AS
        SELECT
            a.id            AS asset_id,
            a.asset_code,
            a.name          AS asset_name,
            ach.id          AS history_id,
            ach.occurred_at,
            ach.operation,
            p.sku           AS component_sku,
            p.name          AS component_name,
            ach.quantity,
            ach.serial_number,
            u.email         AS performed_by,
            ach.reason,
            ach.notes,
            ach.inventory_movement_id,
            ach.nc_id
        FROM assets a
        JOIN asset_component_history ach ON ach.asset_id = a.id
        LEFT JOIN productos p ON p.id = ach.product_id
        LEFT JOIN users u ON u.id = ach.user_id
        ORDER BY a.asset_code, ach.occurred_at DESC;
    """)

    # ── 7. fn_on_component_install ──────────────────────────────────────────────
    # Trigger AFTER INSERT en asset_components:
    #   a) Crea movimiento ISSUE en inventory_movements (la pieza sale del stock)
    #   b) Escribe fila inmutable en asset_component_history
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_on_component_install()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        DECLARE
            v_movement_id UUID;
        BEGIN
            IF NEW.product_id IS NULL THEN
                RETURN NEW;
            END IF;

            v_movement_id := gen_random_uuid();

            INSERT INTO inventory_movements (
                id, product_id, movement_type, source_type, source_id,
                qty_out, moved_on, origin, observations, created_by_user_id, created_at
            ) VALUES (
                v_movement_id,
                NEW.product_id,
                'ISSUE',
                'ASSET_INSTALL',
                NEW.id,
                NEW.quantity,
                NEW.installed_at,
                'Instalado en equipo ' || (SELECT asset_code FROM assets WHERE id = NEW.asset_id),
                'Instalación automática vía asset_components',
                NEW.installed_by,
                now()
            );

            INSERT INTO asset_component_history (
                id, asset_id, product_id, operation, quantity, serial_number,
                occurred_at, user_id, inventory_movement_id, reason, notes
            ) VALUES (
                gen_random_uuid(),
                NEW.asset_id,
                NEW.product_id,
                'INSTALL',
                NEW.quantity,
                NEW.serial_number,
                NEW.installed_at,
                NEW.installed_by,
                v_movement_id,
                NULL,
                NEW.notes
            );

            RETURN NEW;
        END;
        $$;
    """)

    # ── 8. trg_asset_component_install ──────────────────────────────────────────
    op.execute("DROP TRIGGER IF EXISTS trg_asset_component_install ON asset_components")
    op.execute("""
        CREATE TRIGGER trg_asset_component_install
        AFTER INSERT ON asset_components
        FOR EACH ROW EXECUTE FUNCTION fn_on_component_install()
    """)

    # ── 9. fn_remove_asset_component ────────────────────────────────────────────
    # Retira una pieza de un equipo. Dos casos:
    #   p_is_reusable=TRUE  → RETURN_IN (pieza vuelve al stock)
    #   p_is_reusable=FALSE → NC con ASSET_REMOVAL + ADJUSTMENT_OUT (pieza defectuosa)
    # Siempre escribe asset_component_history y borra de asset_components.
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_remove_asset_component(
            p_asset_component_id UUID,
            p_is_reusable        BOOLEAN,
            p_user_id            UUID,
            p_reason             TEXT DEFAULT NULL,
            p_notes              TEXT DEFAULT NULL
        )
        RETURNS void LANGUAGE plpgsql AS $$
        DECLARE
            v_comp          asset_components%ROWTYPE;
            v_asset_code    TEXT;
            v_movement_id   UUID;
            v_nc_id         UUID;
        BEGIN
            SELECT * INTO v_comp FROM asset_components WHERE id = p_asset_component_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'asset_component % not found', p_asset_component_id;
            END IF;

            SELECT asset_code INTO v_asset_code FROM assets WHERE id = v_comp.asset_id;

            v_movement_id := gen_random_uuid();

            IF p_is_reusable THEN
                -- Pieza buena: vuelve al stock
                INSERT INTO inventory_movements (
                    id, product_id, movement_type, source_type, source_id,
                    qty_in, moved_on, origin, observations, created_by_user_id, created_at
                ) VALUES (
                    v_movement_id,
                    v_comp.product_id,
                    'RETURN_IN',
                    'ASSET_REMOVE',
                    v_comp.id,
                    v_comp.quantity,
                    now(),
                    'Removido de equipo ' || v_asset_code,
                    COALESCE(p_reason, 'Retirado de equipo'),
                    p_user_id,
                    now()
                );
            ELSE
                -- Pieza defectuosa: NC + ajuste de salida
                v_nc_id := gen_random_uuid();
                INSERT INTO no_conformes (
                    id, nc_source, asset_id, product_id, quantity,
                    action_taken, adjustment_type, status,
                    observations, detected_on, created_at
                ) VALUES (
                    v_nc_id,
                    'ASSET_REMOVAL',
                    v_comp.asset_id,
                    v_comp.product_id,
                    v_comp.quantity,
                    'Ajuste',
                    'Salida',
                    'Pendiente',
                    COALESCE(p_reason, 'Pieza defectuosa retirada de equipo'),
                    CURRENT_DATE,
                    now()
                );

                -- El NC dispara su propio movimiento ADJUSTMENT_OUT vía trigger existente
                -- (fn_create_inv_movement_from_nc si existe, o se crea aquí como fallback)
                INSERT INTO inventory_movements (
                    id, product_id, movement_type, source_type, source_id,
                    qty_out, moved_on, origin, observations, created_by_user_id, created_at
                ) VALUES (
                    v_movement_id,
                    v_comp.product_id,
                    'ADJUSTMENT_OUT',
                    'ASSET_REMOVE',
                    v_comp.id,
                    v_comp.quantity,
                    now(),
                    'Removido defectuoso de equipo ' || v_asset_code,
                    COALESCE(p_reason, 'Pieza defectuosa'),
                    p_user_id,
                    now()
                );
            END IF;

            INSERT INTO asset_component_history (
                id, asset_id, product_id, operation, quantity, serial_number,
                occurred_at, user_id, inventory_movement_id, nc_id, reason, notes
            ) VALUES (
                gen_random_uuid(),
                v_comp.asset_id,
                v_comp.product_id,
                'REMOVE',
                v_comp.quantity,
                v_comp.serial_number,
                now(),
                p_user_id,
                v_movement_id,
                v_nc_id,
                p_reason,
                p_notes
            );

            DELETE FROM asset_components WHERE id = p_asset_component_id;
        END;
        $$;
    """)

    # ── 10. fn_close_monthly_snapshot ───────────────────────────────────────────
    # Inserta un snapshot por cada producto activo al momento de la llamada.
    # Usa ON CONFLICT para ser idempotente (se puede rellamar el mismo día).
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_close_monthly_snapshot()
        RETURNS INTEGER LANGUAGE plpgsql AS $$
        DECLARE
            v_date  DATE := (date_trunc('month', now()) + interval '1 month - 1 day')::date;
            v_count INTEGER;
        BEGIN
            INSERT INTO inventory_snapshots (product_id, snapshot_date, quantity_on_hand, avg_unit_cost, total_value)
            SELECT
                product_id,
                v_date,
                quantity_on_hand,
                avg_unit_cost,
                total_value
            FROM v_inventory_current
            WHERE quantity_on_hand <> 0
            ON CONFLICT (product_id, snapshot_date) DO UPDATE
                SET quantity_on_hand = EXCLUDED.quantity_on_hand,
                    avg_unit_cost    = EXCLUDED.avg_unit_cost,
                    total_value      = EXCLUDED.total_value;

            GET DIAGNOSTICS v_count = ROW_COUNT;
            RETURN v_count;
        END;
        $$;
    """)

    # ── 11. inventory_movements: columnas source_type / source_id ───────────────
    # Necesarias para los nuevos tipos ASSET_INSTALL / ASSET_REMOVE
    op.execute("""
        ALTER TABLE inventory_movements
            ADD COLUMN IF NOT EXISTS source_type TEXT,
            ADD COLUMN IF NOT EXISTS source_id   UUID;
    """)

    # ── 12. pg_cron: cierre mensual ─────────────────────────────────────────────
    # Ejecuta fn_close_monthly_snapshot el último día de cada mes a las 23:00.
    # '28-31 * *' cubre los días 28-31; la función es idempotente si se llama
    # el 28 en meses cortos (el snapshot queda con la fecha del último día del mes).
    op.execute("""
        SELECT cron.schedule(
            'close-monthly-inventory-snapshot',
            '0 23 28-31 * *',
            $$SELECT fn_close_monthly_snapshot()$$
        );
    """)


def downgrade() -> None:
    op.execute("""
        SELECT cron.unschedule('close-monthly-inventory-snapshot');
    """)

    op.execute("DROP COLUMN IF EXISTS source_type FROM inventory_movements")
    op.execute("DROP COLUMN IF EXISTS source_id   FROM inventory_movements")
    op.execute("DROP FUNCTION IF EXISTS fn_close_monthly_snapshot()")
    op.execute("DROP FUNCTION IF EXISTS fn_remove_asset_component(UUID, BOOLEAN, UUID, TEXT, TEXT)")
    op.execute("DROP TRIGGER IF EXISTS trg_asset_component_install ON asset_components")
    op.execute("DROP FUNCTION IF EXISTS fn_on_component_install()")
    op.execute("DROP VIEW IF EXISTS v_asset_repair_history")
    op.execute("DROP VIEW IF EXISTS v_asset_current_components")
    op.execute("DROP VIEW IF EXISTS v_internal_inventory")
    op.execute("DROP VIEW IF EXISTS v_saleable_inventory")
    op.execute("DROP VIEW IF EXISTS v_inventory_kpis")
    op.execute("DROP VIEW IF EXISTS v_inventory_current")

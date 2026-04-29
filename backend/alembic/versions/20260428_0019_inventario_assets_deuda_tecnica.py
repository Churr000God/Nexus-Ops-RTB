"""inventario_assets: deuda técnica — renames + backfill FKs + recompute correcto

Cambios:
  1. RENAME TABLE movimientos_inventario → inventory_movements
  2. RENAME COLUMN productos.is_internal → is_saleable (con inversión de valor)
  3. Actualiza cuerpos de funciones que referenciaban movimientos_inventario
  4. Reemplaza recompute_inventory_rollups con fórmulas correctas (contexto/07)
  5. Backfill product_id en solicitudes_material, entradas_mercancia, inventario
  6. Ejecuta rollup global sobre inventario

Revision ID: 20260428_0019
Revises: 20260428_0018
Create Date: 2026-04-28
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260428_0019"
down_revision: str = "20260428_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1. Renombrar tabla ──────────────────────────────────────────────────────
    # Los triggers sobre la tabla se mueven automáticamente con el RENAME.
    # Los índices y FKs también se preservan.
    op.execute("ALTER TABLE movimientos_inventario RENAME TO inventory_movements")

    # ── 2. Renombrar columna productos.is_internal → is_saleable ───────────────
    # is_internal=FALSE (default) significaba "NO es interno" = ES vendible
    # is_saleable=TRUE  (nuevo default) significa "SÍ es vendible"
    # ∴ se invierte el valor actual con NOT.
    op.execute("ALTER TABLE productos RENAME COLUMN is_internal TO is_saleable")
    op.execute("UPDATE productos SET is_saleable = NOT is_saleable")
    op.execute("ALTER TABLE productos ALTER COLUMN is_saleable SET DEFAULT TRUE")

    # ── 3a. fn_recalc_product_avg_cost — actualizar referencia de tabla ─────────
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_recalc_product_avg_cost()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        DECLARE
            v_moving_avg_months SMALLINT;
            v_old_cost          NUMERIC(14,4);
            v_new_cost          NUMERIC(14,4);
        BEGIN
            IF NEW.movement_type NOT IN ('RECEIPT', 'Entrada', 'OPENING_BALANCE') THEN
                RETURN NEW;
            END IF;
            IF NEW.unit_cost IS NULL OR NEW.qty_in IS NULL OR NEW.qty_in <= 0 THEN
                RETURN NEW;
            END IF;
            IF NEW.product_id IS NULL THEN
                RETURN NEW;
            END IF;

            SELECT moving_avg_months, current_avg_cost
            INTO   v_moving_avg_months, v_old_cost
            FROM   productos
            WHERE  id = NEW.product_id;

            IF NOT FOUND THEN
                RETURN NEW;
            END IF;

            SELECT SUM(qty_in * unit_cost) / NULLIF(SUM(qty_in), 0)
            INTO   v_new_cost
            FROM   inventory_movements
            WHERE  product_id    = NEW.product_id
              AND  movement_type IN ('RECEIPT', 'Entrada', 'OPENING_BALANCE')
              AND  unit_cost     IS NOT NULL
              AND  qty_in        IS NOT NULL
              AND  qty_in        > 0
              AND  COALESCE(moved_on, created_at) >= (
                       now() - (v_moving_avg_months::TEXT || ' months')::INTERVAL
                   );

            IF v_new_cost IS NULL THEN
                RETURN NEW;
            END IF;

            UPDATE productos
            SET  current_avg_cost            = v_new_cost,
                 current_avg_cost_updated_at = now(),
                 updated_at                  = now()
            WHERE id = NEW.product_id;

            INSERT INTO product_cost_history (
                product_id, previous_avg_cost, new_avg_cost,
                quantity_received, unit_cost_of_receipt,
                triggered_by, source_id, recorded_at
            ) VALUES (
                NEW.product_id, v_old_cost, v_new_cost,
                NEW.qty_in, NEW.unit_cost,
                'GOODS_RECEIPT', NEW.id, now()
            );

            RETURN NEW;
        END;
        $$;
    """)

    # ── 3b. fn_refresh_all_avg_costs — actualizar referencia de tabla ───────────
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_refresh_all_avg_costs()
        RETURNS INTEGER LANGUAGE plpgsql AS $$
        DECLARE
            v_count INTEGER := 0;
            v_rec   RECORD;
            v_new_cost NUMERIC(14,4);
        BEGIN
            FOR v_rec IN
                SELECT id, moving_avg_months, current_avg_cost
                FROM   productos
                WHERE  is_active = TRUE OR is_active IS NULL
            LOOP
                SELECT SUM(qty_in * unit_cost) / NULLIF(SUM(qty_in), 0)
                INTO   v_new_cost
                FROM   inventory_movements
                WHERE  product_id    = v_rec.id
                  AND  movement_type IN ('RECEIPT', 'Entrada', 'OPENING_BALANCE')
                  AND  unit_cost     IS NOT NULL
                  AND  qty_in        IS NOT NULL
                  AND  qty_in        > 0
                  AND  COALESCE(moved_on, created_at) >= (
                           now() - (v_rec.moving_avg_months::TEXT || ' months')::INTERVAL
                       );

                CONTINUE WHEN v_new_cost IS NULL;
                CONTINUE WHEN v_rec.current_avg_cost IS NOT DISTINCT FROM v_new_cost;

                UPDATE productos
                SET  current_avg_cost            = v_new_cost,
                     current_avg_cost_updated_at = now(),
                     updated_at                  = now()
                WHERE id = v_rec.id;

                INSERT INTO product_cost_history (
                    product_id, previous_avg_cost, new_avg_cost,
                    triggered_by, recorded_at
                ) VALUES (
                    v_rec.id, v_rec.current_avg_cost, v_new_cost,
                    'NIGHTLY_REFRESH', now()
                );

                v_count := v_count + 1;
            END LOOP;

            RETURN v_count;
        END;
        $$;
    """)

    # ── 3c. fn_packing_inv_movement — actualizar referencia de tabla ────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_packing_inv_movement()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        DECLARE
            v_qty_delta NUMERIC(14,4);
        BEGIN
            v_qty_delta := NEW.quantity_packed - OLD.quantity_packed;
            IF v_qty_delta = 0 OR NEW.product_id IS NULL THEN
                RETURN NEW;
            END IF;

            INSERT INTO inventory_movements (
                id, product_id, movement_type, qty_out,
                moved_on, origin, observations
            )
            VALUES (
                gen_random_uuid(),
                NEW.product_id,
                'ISSUE',
                v_qty_delta,
                NOW(),
                'Pedido ' || NEW.order_id::text,
                'Empacado order_item ' || NEW.order_item_id::text
            );
            RETURN NEW;
        END;
        $$;
    """)

    # ── 3d. fn_create_inv_movement_from_receipt — actualizar referencia ─────────
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_create_inv_movement_from_receipt()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        DECLARE
            v_receipt_number TEXT;
            v_current_qty    NUMERIC;
            v_current_cost   NUMERIC;
            v_new_avg_cost   NUMERIC;
        BEGIN
            IF NEW.product_id IS NULL THEN
                RETURN NEW;
            END IF;

            SELECT receipt_number INTO v_receipt_number
              FROM goods_receipts WHERE receipt_id = NEW.receipt_id;

            INSERT INTO inventory_movements (
                id, product_id, movement_type, qty_in, unit_cost,
                moved_on, origin, observations, created_at
            ) VALUES (
                gen_random_uuid(),
                NEW.product_id,
                'RECEIPT',
                NEW.quantity_received,
                NEW.unit_cost,
                NOW(),
                'GR-' || COALESCE(v_receipt_number, NEW.receipt_id::TEXT),
                'Generado automáticamente por recepción de mercancía',
                NOW()
            );

            SELECT COALESCE(real_qty, 0), COALESCE(unit_cost, 0)
              INTO v_current_qty, v_current_cost
              FROM inventario
             WHERE product_id = NEW.product_id
             LIMIT 1;

            IF v_current_qty + NEW.quantity_received > 0 THEN
                v_new_avg_cost := (
                    (v_current_qty * v_current_cost)
                    + (NEW.quantity_received * COALESCE(NEW.unit_cost, 0))
                ) / (v_current_qty + NEW.quantity_received);

                UPDATE inventario
                   SET real_qty         = COALESCE(real_qty, 0) + NEW.quantity_received,
                       inbound_real     = COALESCE(inbound_real, 0) + NEW.quantity_received,
                       unit_cost        = v_new_avg_cost,
                       stock_total_cost = (COALESCE(real_qty, 0) + NEW.quantity_received)
                                          * v_new_avg_cost,
                       last_inbound_on  = CURRENT_DATE,
                       updated_on       = NOW()
                 WHERE product_id = NEW.product_id;
            END IF;

            RETURN NEW;
        END;
        $$;
    """)

    # ── 4. recompute_inventory_rollups — fórmulas CORRECTAS (contexto/07) ───────
    # Reemplaza la versión incorrecta que usaba movimientos_inventario para cantidades.
    # Fuentes correctas:
    #   real_in  = entradas_mercancia.qty_arrived
    #   real_out = cotizacion_items.qty_packed WHERE aprob%
    #   th_in    = solicitudes_material.qty_requested
    #   th_out   = cotizacion_items.qty_requested WHERE aprob%
    #   nc       = no_conformes.inventory_adjustment
    op.execute("""
        CREATE OR REPLACE FUNCTION app.recompute_inventory_rollups(p_inventory_id uuid)
        RETURNS void LANGUAGE plpgsql AS $fn$
        DECLARE
            v_product_id uuid;
        BEGIN
            SELECT product_id INTO v_product_id
            FROM inventario WHERE id = p_inventory_id;

            IF v_product_id IS NULL THEN
                RETURN;
            END IF;

            UPDATE inventario i
            SET
                inbound_real             = COALESCE(real_in.v,  0),
                outbound_real            = COALESCE(real_out.v, 0),
                inbound_theoretical      = COALESCE(th_in.v,   0),
                outbound_theoretical     = COALESCE(th_out.v,  0),
                nonconformity_adjustment = COALESCE(nc.v,      0),
                real_qty      = COALESCE(real_in.v, 0)  - COALESCE(real_out.v, 0)  + COALESCE(nc.v, 0),
                theoretical_qty = COALESCE(th_in.v, 0) - COALESCE(th_out.v,  0),
                stock_diff    = (COALESCE(real_in.v, 0)  - COALESCE(real_out.v, 0) + COALESCE(nc.v, 0))
                              - (COALESCE(th_in.v, 0)    - COALESCE(th_out.v,  0)),
                stock_total_cost = (COALESCE(real_in.v, 0) - COALESCE(real_out.v, 0) + COALESCE(nc.v, 0))
                                 * COALESCE(pr.unit_price, 0)
            FROM productos pr,
            LATERAL (SELECT COALESCE(SUM(qty_arrived), 0) AS v
                     FROM entradas_mercancia WHERE product_id = v_product_id) AS real_in,
            LATERAL (SELECT COALESCE(SUM(qty_packed), 0) AS v
                     FROM cotizacion_items
                     WHERE product_id = v_product_id
                       AND LOWER(COALESCE(quote_status, '')) LIKE '%aprob%') AS real_out,
            LATERAL (SELECT COALESCE(SUM(qty_requested), 0) AS v
                     FROM solicitudes_material WHERE product_id = v_product_id) AS th_in,
            LATERAL (SELECT COALESCE(SUM(qty_requested), 0) AS v
                     FROM cotizacion_items
                     WHERE product_id = v_product_id
                       AND LOWER(COALESCE(quote_status, '')) LIKE '%aprob%') AS th_out,
            LATERAL (SELECT COALESCE(SUM(inventory_adjustment), 0) AS v
                     FROM no_conformes WHERE product_id = v_product_id) AS nc
            WHERE i.id = p_inventory_id
              AND pr.id = v_product_id;
        END;
        $fn$;
    """)

    # ── 5. Backfill solicitudes_material.product_id ─────────────────────────────
    # Llave natural: product_sku = productos.sku (~860 filas esperadas)
    op.execute("""
        UPDATE solicitudes_material sm
        SET product_id = p.id
        FROM productos p
        WHERE p.sku = sm.product_sku
          AND sm.product_id IS NULL;
    """)

    # ── 6. Backfill entradas_mercancia.product_id ───────────────────────────────
    # Puente: entradas_mercancia.external_product_id → cotizacion_items.external_product_id
    # (~1260 filas esperadas)
    op.execute("""
        UPDATE entradas_mercancia em
        SET product_id = ci.product_id
        FROM (
            SELECT DISTINCT ON (external_product_id) external_product_id, product_id
            FROM cotizacion_items
            WHERE product_id IS NOT NULL AND external_product_id IS NOT NULL
            ORDER BY external_product_id, created_at DESC
        ) ci
        WHERE ci.external_product_id = em.external_product_id
          AND em.product_id IS NULL;
    """)

    # ── 7. Backfill inventario.product_id ───────────────────────────────────────
    # Paso A: por internal_code = sku (~69 filas directas)
    op.execute("""
        UPDATE inventario i
        SET product_id = p.id
        FROM productos p
        WHERE p.sku = i.internal_code
          AND i.product_id IS NULL;
    """)

    # ── 8. Rollup global sobre registros con product_id resuelto ────────────────
    op.execute("""
        DO $$
        DECLARE r RECORD;
        BEGIN
            FOR r IN SELECT id FROM inventario WHERE product_id IS NOT NULL LOOP
                PERFORM app.recompute_inventory_rollups(r.id);
            END LOOP;
        END;
        $$;
    """)

    op.execute("""
        DO $$
        DECLARE r RECORD;
        BEGIN
            FOR r IN SELECT id FROM productos LOOP
                PERFORM app.recompute_product_rollups(r.id);
            END LOOP;
        END;
        $$;
    """)


def downgrade() -> None:
    # El downgrade de rollups y backfills no es reversible (datos calculados).
    # Solo revertimos los renames estructurales.

    op.execute("ALTER TABLE inventory_movements RENAME TO movimientos_inventario")

    op.execute("UPDATE productos SET is_saleable = NOT is_saleable")
    op.execute("ALTER TABLE productos RENAME COLUMN is_saleable TO is_internal")
    op.execute("ALTER TABLE productos ALTER COLUMN is_internal SET DEFAULT FALSE")

"""productos_pricing: funciones SQL, triggers y pg_cron

Cambios:
  1. fn_recalc_product_avg_cost() — trigger de costo promedio móvil
     Dispara en INSERT sobre movimientos_inventario tipo RECEIPT/Entrada
  2. trg_recalc_avg_cost — trigger en movimientos_inventario
  3. fn_refresh_all_avg_costs() — batch nocturno; retorna # productos actualizados
  4. fn_get_quote_pricing(product_id, customer_id, quantity) — cascade de pricing
  5. pg_cron: job diario 02:00 que ejecuta fn_refresh_all_avg_costs()
  6. Audit triggers en productos, categorias, customer_contract_prices

Revision ID: 20260428_0013
Revises: 20260428_0012
Create Date: 2026-04-28
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260428_0013"
down_revision: str = "20260428_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1. fn_recalc_product_avg_cost ──────────────────────────────────────────
    # Trigger function: recalcula current_avg_cost en productos después de cada
    # INSERT en movimientos_inventario de tipo RECEIPT/Entrada/OPENING_BALANCE.
    # Solo procesa filas con unit_cost IS NOT NULL y qty_in > 0.
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_recalc_product_avg_cost()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        DECLARE
            v_moving_avg_months SMALLINT;
            v_old_cost          NUMERIC(14,4);
            v_new_cost          NUMERIC(14,4);
        BEGIN
            -- Solo movimientos de entrada con costo conocido
            IF NEW.movement_type NOT IN ('RECEIPT', 'Entrada', 'OPENING_BALANCE') THEN
                RETURN NEW;
            END IF;
            IF NEW.unit_cost IS NULL OR NEW.qty_in IS NULL OR NEW.qty_in <= 0 THEN
                RETURN NEW;
            END IF;
            IF NEW.product_id IS NULL THEN
                RETURN NEW;
            END IF;

            -- Obtener ventana de meses y costo anterior del producto
            SELECT moving_avg_months, current_avg_cost
            INTO   v_moving_avg_months, v_old_cost
            FROM   productos
            WHERE  id = NEW.product_id;

            IF NOT FOUND THEN
                RETURN NEW;
            END IF;

            -- Promedio ponderado de los últimos N meses (incluye el NEW ya insertado)
            SELECT SUM(qty_in * unit_cost) / NULLIF(SUM(qty_in), 0)
            INTO   v_new_cost
            FROM   movimientos_inventario
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

            -- Actualizar costo promedio en productos
            UPDATE productos
            SET  current_avg_cost            = v_new_cost,
                 current_avg_cost_updated_at = now(),
                 updated_at                  = now()
            WHERE id = NEW.product_id;

            -- Bitácora inmutable
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

    # ── 2. trg_recalc_avg_cost ─────────────────────────────────────────────────
    op.execute("""
        CREATE TRIGGER trg_recalc_avg_cost
        AFTER INSERT ON movimientos_inventario
        FOR EACH ROW
        EXECUTE FUNCTION fn_recalc_product_avg_cost();
    """)

    # ── 3. fn_refresh_all_avg_costs ────────────────────────────────────────────
    # Job nocturno: la ventana de N meses se mueve cada día aunque no entren
    # compras. Este batch recalcula todos los productos activos y retorna el
    # número de productos cuyo costo efectivamente cambió.
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
                FROM   movimientos_inventario
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

    # ── 4. fn_get_quote_pricing ────────────────────────────────────────────────
    # Cascade de pricing para cotizaciones.
    # Prioridad: (1) Ariba vigente → CONTRACT_FIXED
    #            (2) PASSTHROUGH   → precio = costo (sin margen)
    #            (3) MOVING_AVG    → precio = costo × (1 + margen/100)
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_get_quote_pricing(
            p_product_id  UUID,
            p_customer_id UUID,
            p_quantity    NUMERIC DEFAULT 1
        )
        RETURNS TABLE (
            suggested_unit_cost  NUMERIC,
            suggested_unit_price NUMERIC,
            cost_basis           TEXT,
            contract_price_id    UUID,
            pricing_source       TEXT
        ) LANGUAGE plpgsql STABLE AS $$
        DECLARE
            v_contract  customer_contract_prices%ROWTYPE;
            v_product   productos%ROWTYPE;
            v_margin    NUMERIC(10,2);
        BEGIN
            -- 1. ¿Existe convenio Ariba vigente?
            SELECT * INTO v_contract
            FROM   customer_contract_prices
            WHERE  customer_id = p_customer_id
              AND  product_id  = p_product_id
              AND  is_current  = TRUE
              AND  valid_from  <= CURRENT_DATE
              AND  (valid_to IS NULL OR valid_to >= CURRENT_DATE)
            LIMIT 1;

            IF FOUND THEN
                RETURN QUERY SELECT
                    v_contract.fixed_sale_price,
                    v_contract.fixed_sale_price,
                    'CONTRACT_FIXED'::TEXT,
                    v_contract.id,
                    'ARIBA_CONTRACT'::TEXT;
                RETURN;
            END IF;

            -- 2. Datos del producto
            SELECT * INTO v_product FROM productos WHERE id = p_product_id;

            IF NOT FOUND OR v_product.current_avg_cost IS NULL THEN
                RETURN QUERY SELECT
                    NULL::NUMERIC,
                    NULL::NUMERIC,
                    'NO_COST'::TEXT,
                    NULL::UUID,
                    'NO_COST_AVAILABLE'::TEXT;
                RETURN;
            END IF;

            -- 3. Margen de la categoría
            SELECT profit_margin_percent INTO v_margin
            FROM   categorias
            WHERE  id = v_product.category_id;

            -- 4. Aplicar estrategia de pricing
            IF v_product.pricing_strategy = 'PASSTHROUGH' THEN
                RETURN QUERY SELECT
                    v_product.current_avg_cost,
                    v_product.current_avg_cost,
                    'PASSTHROUGH'::TEXT,
                    NULL::UUID,
                    'PRODUCT_PASSTHROUGH'::TEXT;
            ELSE
                RETURN QUERY SELECT
                    v_product.current_avg_cost,
                    ROUND(
                        v_product.current_avg_cost
                        * (1 + COALESCE(v_margin, 0) / 100),
                        4
                    ),
                    'MOVING_AVG'::TEXT,
                    NULL::UUID,
                    'PRODUCT_DEFAULT'::TEXT;
            END IF;
        END;
        $$;
    """)

    # ── 5. pg_cron: job nocturno ───────────────────────────────────────────────
    # Habilitar extensión y programar el batch a las 02:00 cada día.
    # En Supabase, pg_cron está disponible en el proyecto de base de datos.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_cron;")
    op.execute("""
        SELECT cron.schedule(
            'rtb-nightly-avg-cost-refresh',
            '0 2 * * *',
            $$SELECT public.fn_refresh_all_avg_costs()$$
        );
    """)

    # ── 6. Audit triggers ─────────────────────────────────────────────────────
    # fn_audit_changes() ya existe (migración 0010). Solo se crean los triggers.
    op.execute("""
        CREATE TRIGGER trg_audit_productos
        AFTER INSERT OR UPDATE OR DELETE ON productos
        FOR EACH ROW EXECUTE FUNCTION fn_audit_changes();
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_categorias
        AFTER INSERT OR UPDATE OR DELETE ON categorias
        FOR EACH ROW EXECUTE FUNCTION fn_audit_changes();
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_customer_contract_prices
        AFTER INSERT OR UPDATE OR DELETE ON customer_contract_prices
        FOR EACH ROW EXECUTE FUNCTION fn_audit_changes();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_audit_customer_contract_prices ON customer_contract_prices;")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_categorias ON categorias;")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_productos ON productos;")

    op.execute("SELECT cron.unschedule('rtb-nightly-avg-cost-refresh');")

    op.execute("DROP FUNCTION IF EXISTS fn_get_quote_pricing(UUID, UUID, NUMERIC);")
    op.execute("DROP FUNCTION IF EXISTS fn_refresh_all_avg_costs();")
    op.execute("DROP TRIGGER IF EXISTS trg_recalc_avg_cost ON movimientos_inventario;")
    op.execute("DROP FUNCTION IF EXISTS fn_recalc_product_avg_cost();")

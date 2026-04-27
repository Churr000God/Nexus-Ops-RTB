"""fix inventory/product rollup logic and ventas period fields

Cambios aplicados:
  1. recompute_product_rollups: elimina q.created_on como fallback en last_outbound_date
  2. recompute_inventory_rollups: calcula inbound/outbound_theoretical desde sus fuentes
     correctas (entradas_mercancia y cotizacion_items) en lugar de copiar los valores reales
  3. trg_ventas_period_fields: nuevo trigger BEFORE INSERT/UPDATE en ventas que auto-calcula
     year_month (YYYY-MM) y quadrimester (Ene-Abr / May-Ago / Sep-Dic)
  4. Backfill de year_month y quadrimester para filas existentes con sold_on no nulo

Revision ID: 20260427_0009
Revises: 8aa3dffe7aa3
Create Date: 2026-04-27 00:00:00
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op


revision: str = "20260427_0009"
down_revision: str | None = "8aa3dffe7aa3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS app;")

    # 1. Fix last_outbound_date — remove q.created_on fallback
    op.execute(
        """
        CREATE OR REPLACE FUNCTION app.recompute_product_rollups(p_product_id uuid)
        RETURNS void
        LANGUAGE plpgsql
        AS $fn$
        BEGIN
            UPDATE productos p
            SET
                theoretical_outflow = agg.theoretical_outflow,
                real_outflow = agg.real_outflow,
                total_accumulated_sales = agg.total_accumulated_sales,
                demand_90_days = agg.demand_90_days,
                demand_180_days = agg.demand_180_days,
                committed_demand = agg.committed_demand,
                last_outbound_date = agg.last_outbound_date
            FROM (
                SELECT
                    qi.product_id AS product_id,
                    SUM(qi.qty_requested) AS theoretical_outflow,
                    SUM(CASE WHEN COALESCE(LOWER(q.status), '') IN ('aprobada', 'aprobado') THEN qi.qty_packed ELSE 0 END) AS real_outflow,
                    SUM(CASE WHEN COALESCE(LOWER(q.status), '') IN ('aprobada', 'aprobado') THEN qi.subtotal ELSE 0 END) AS total_accumulated_sales,
                    SUM(
                        CASE
                            WHEN COALESCE(qi.last_updated_on, q.created_on) >= (NOW() - INTERVAL '90 days')
                            THEN qi.qty_requested
                            ELSE 0
                        END
                    ) AS demand_90_days,
                    SUM(
                        CASE
                            WHEN COALESCE(qi.last_updated_on, q.created_on) >= (NOW() - INTERVAL '180 days')
                            THEN qi.qty_requested
                            ELSE 0
                        END
                    ) AS demand_180_days,
                    SUM(
                        CASE
                            WHEN COALESCE(LOWER(q.status), '') NOT IN ('cancelada', 'rechazada', 'expirada')
                            THEN qi.qty_missing
                            ELSE 0
                        END
                    ) AS committed_demand,
                    MAX(
                        CASE
                            WHEN COALESCE(qi.qty_packed, 0) > 0 THEN qi.last_updated_on::date
                            ELSE NULL
                        END
                    ) AS last_outbound_date
                FROM cotizacion_items qi
                JOIN cotizaciones q ON q.id = qi.quote_id
                WHERE qi.product_id = p_product_id
                GROUP BY qi.product_id
            ) AS agg
            WHERE p.id = agg.product_id;
        END;
        $fn$;
        """
    )

    # 2. Fix inbound_theoretical / outbound_theoretical — use correct sources
    op.execute(
        """
        CREATE OR REPLACE FUNCTION app.recompute_inventory_rollups(p_inventory_id uuid)
        RETURNS void
        LANGUAGE plpgsql
        AS $fn$
        DECLARE
            v_product_id uuid;
        BEGIN
            SELECT product_id INTO v_product_id
            FROM inventario
            WHERE id = p_inventory_id;

            UPDATE inventario i
            SET
                inbound_real         = mv.inbound_real,
                outbound_real        = mv.outbound_real,
                inbound_theoretical  = th_in.inbound_theoretical,
                outbound_theoretical = th_out.outbound_theoretical,
                nonconformity_adjustment = nc.nonconformity_adjustment,
                real_qty       = mv.inbound_real - mv.outbound_real + nc.nonconformity_adjustment,
                theoretical_qty = th_in.inbound_theoretical - th_out.outbound_theoretical,
                stock_diff     = (mv.inbound_real - mv.outbound_real + nc.nonconformity_adjustment)
                                 - (th_in.inbound_theoretical - th_out.outbound_theoretical),
                stock_total_cost = (mv.inbound_real - mv.outbound_real + nc.nonconformity_adjustment)
                                   * i.unit_cost
            FROM (
                SELECT
                    COALESCE(SUM(CASE WHEN movement_type IN ('Entrada', 'Devolución') THEN qty_in  ELSE 0 END), 0) AS inbound_real,
                    COALESCE(SUM(CASE WHEN movement_type = 'Salida'                   THEN qty_out ELSE 0 END), 0) AS outbound_real
                FROM movimientos_inventario
                WHERE product_id = v_product_id
            ) AS mv,
            (
                SELECT COALESCE(SUM(em.qty_requested_converted), 0) AS inbound_theoretical
                FROM entradas_mercancia em
                WHERE em.product_id = v_product_id
            ) AS th_in,
            (
                SELECT COALESCE(SUM(ci.qty_requested), 0) AS outbound_theoretical
                FROM cotizacion_items ci
                JOIN cotizaciones q ON q.id = ci.quote_id
                WHERE ci.product_id = v_product_id
                  AND LOWER(COALESCE(q.status, '')) NOT IN ('cancelada', 'rechazada', 'expirada')
            ) AS th_out,
            (
                SELECT COALESCE(SUM(inventory_adjustment), 0) AS nonconformity_adjustment
                FROM no_conformes
                WHERE inventory_item_id = p_inventory_id
            ) AS nc
            WHERE i.id = p_inventory_id;
        END;
        $fn$;
        """
    )

    # 3. New trigger: auto-populate year_month and quadrimester on ventas
    op.execute(
        """
        CREATE OR REPLACE FUNCTION app.trg_ventas_period_fields()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $fn$
        BEGIN
            IF NEW.sold_on IS NOT NULL THEN
                NEW.year_month := to_char(NEW.sold_on, 'YYYY-MM');
                NEW.quadrimester := CASE
                    WHEN EXTRACT(MONTH FROM NEW.sold_on) BETWEEN 1 AND 4 THEN 'Ene-Abr'
                    WHEN EXTRACT(MONTH FROM NEW.sold_on) BETWEEN 5 AND 8 THEN 'May-Ago'
                    ELSE 'Sep-Dic'
                END;
            END IF;
            RETURN NEW;
        END;
        $fn$;
        """
    )
    op.execute("DROP TRIGGER IF EXISTS trg_ventas_period_fields ON ventas;")
    op.execute(
        """
        CREATE TRIGGER trg_ventas_period_fields
        BEFORE INSERT OR UPDATE ON ventas
        FOR EACH ROW EXECUTE FUNCTION app.trg_ventas_period_fields();
        """
    )

    # 4. Backfill year_month and quadrimester for existing rows
    op.execute(
        """
        UPDATE ventas
        SET
            year_month = to_char(sold_on, 'YYYY-MM'),
            quadrimester = CASE
                WHEN EXTRACT(MONTH FROM sold_on) BETWEEN 1 AND 4 THEN 'Ene-Abr'
                WHEN EXTRACT(MONTH FROM sold_on) BETWEEN 5 AND 8 THEN 'May-Ago'
                ELSE 'Sep-Dic'
            END
        WHERE sold_on IS NOT NULL
          AND (year_month IS NULL OR quadrimester IS NULL);
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_ventas_period_fields ON ventas;")
    op.execute("DROP FUNCTION IF EXISTS app.trg_ventas_period_fields();")
    # Restore previous recompute_product_rollups (with q.created_on fallback)
    op.execute(
        """
        CREATE OR REPLACE FUNCTION app.recompute_product_rollups(p_product_id uuid)
        RETURNS void
        LANGUAGE plpgsql
        AS $fn$
        BEGIN
            UPDATE productos p
            SET
                theoretical_outflow = agg.theoretical_outflow,
                real_outflow = agg.real_outflow,
                total_accumulated_sales = agg.total_accumulated_sales,
                demand_90_days = agg.demand_90_days,
                demand_180_days = agg.demand_180_days,
                committed_demand = agg.committed_demand,
                last_outbound_date = agg.last_outbound_date
            FROM (
                SELECT
                    qi.product_id AS product_id,
                    SUM(qi.qty_requested) AS theoretical_outflow,
                    SUM(CASE WHEN COALESCE(LOWER(q.status), '') IN ('aprobada', 'aprobado') THEN qi.qty_packed ELSE 0 END) AS real_outflow,
                    SUM(CASE WHEN COALESCE(LOWER(q.status), '') IN ('aprobada', 'aprobado') THEN qi.subtotal ELSE 0 END) AS total_accumulated_sales,
                    SUM(
                        CASE
                            WHEN COALESCE(qi.last_updated_on, q.created_on) >= (NOW() - INTERVAL '90 days')
                            THEN qi.qty_requested
                            ELSE 0
                        END
                    ) AS demand_90_days,
                    SUM(
                        CASE
                            WHEN COALESCE(qi.last_updated_on, q.created_on) >= (NOW() - INTERVAL '180 days')
                            THEN qi.qty_requested
                            ELSE 0
                        END
                    ) AS demand_180_days,
                    SUM(
                        CASE
                            WHEN COALESCE(LOWER(q.status), '') NOT IN ('cancelada', 'rechazada', 'expirada')
                            THEN qi.qty_missing
                            ELSE 0
                        END
                    ) AS committed_demand,
                    MAX(
                        CASE
                            WHEN COALESCE(qi.qty_packed, 0) > 0 THEN COALESCE(qi.last_updated_on, q.created_on)::date
                            ELSE NULL
                        END
                    ) AS last_outbound_date
                FROM cotizacion_items qi
                JOIN cotizaciones q ON q.id = qi.quote_id
                WHERE qi.product_id = p_product_id
                GROUP BY qi.product_id
            ) AS agg
            WHERE p.id = agg.product_id;
        END;
        $fn$;
        """
    )
    # Restore previous recompute_inventory_rollups (inbound_theoretical = inbound_real)
    op.execute(
        """
        CREATE OR REPLACE FUNCTION app.recompute_inventory_rollups(p_inventory_id uuid)
        RETURNS void
        LANGUAGE plpgsql
        AS $fn$
        DECLARE
            v_product_id uuid;
        BEGIN
            SELECT product_id INTO v_product_id
            FROM inventario
            WHERE id = p_inventory_id;

            UPDATE inventario i
            SET
                inbound_real = mv.inbound_real,
                outbound_real = mv.outbound_real,
                inbound_theoretical = mv.inbound_real,
                outbound_theoretical = mv.outbound_real,
                nonconformity_adjustment = nc.nonconformity_adjustment,
                real_qty = mv.inbound_real - mv.outbound_real + nc.nonconformity_adjustment,
                theoretical_qty = mv.inbound_real - mv.outbound_real,
                stock_diff = (mv.inbound_real - mv.outbound_real + nc.nonconformity_adjustment) - (mv.inbound_real - mv.outbound_real),
                stock_total_cost = (mv.inbound_real - mv.outbound_real + nc.nonconformity_adjustment) * i.unit_cost
            FROM (
                SELECT
                    COALESCE(SUM(CASE WHEN movement_type IN ('Entrada', 'Devolución') THEN qty_in ELSE 0 END), 0) AS inbound_real,
                    COALESCE(SUM(CASE WHEN movement_type IN ('Salida') THEN qty_out ELSE 0 END), 0) AS outbound_real
                FROM movimientos_inventario
                WHERE product_id = v_product_id
            ) AS mv,
            (
                SELECT COALESCE(SUM(inventory_adjustment), 0) AS nonconformity_adjustment
                FROM no_conformes
                WHERE inventory_item_id = p_inventory_id
            ) AS nc
            WHERE i.id = p_inventory_id;
        END;
        $fn$;
        """
    )

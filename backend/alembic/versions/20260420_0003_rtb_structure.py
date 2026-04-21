"""rtb structure + computed columns

Revision ID: 20260420_0003
Revises: 20260419_0002
Create Date: 2026-04-20 00:00:00
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260420_0003"
down_revision: str | None = "f6a0e4534684"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS categorias (
            id uuid PRIMARY KEY,
            name varchar(120) NOT NULL UNIQUE,
            description text,
            profit_margin_percent numeric(6,4),
            is_active boolean NOT NULL DEFAULT true,
            created_at timestamptz NOT NULL,
            updated_at timestamptz NOT NULL
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS marcas (
            id uuid PRIMARY KEY,
            name varchar(120) NOT NULL UNIQUE,
            description text,
            markup_percent numeric(6,4),
            is_active boolean NOT NULL DEFAULT true,
            created_at timestamptz NOT NULL,
            updated_at timestamptz NOT NULL
        );
        """
    )

    op.execute(
        """
        ALTER TABLE productos
            ADD COLUMN IF NOT EXISTS sat_code varchar(80),
            ADD COLUMN IF NOT EXISTS brand_id uuid,
            ADD COLUMN IF NOT EXISTS category_id uuid,
            ADD COLUMN IF NOT EXISTS warehouse_location varchar(120),
            ADD COLUMN IF NOT EXISTS image_url varchar(500),
            ADD COLUMN IF NOT EXISTS datasheet_url varchar(500),
            ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS unit_price_base numeric(14,4),
            ADD COLUMN IF NOT EXISTS theoretical_outflow numeric(14,4),
            ADD COLUMN IF NOT EXISTS real_outflow numeric(14,4),
            ADD COLUMN IF NOT EXISTS total_accumulated_sales numeric(14,4),
            ADD COLUMN IF NOT EXISTS demand_90_days numeric(14,4),
            ADD COLUMN IF NOT EXISTS demand_180_days numeric(14,4),
            ADD COLUMN IF NOT EXISTS last_outbound_date date,
            ADD COLUMN IF NOT EXISTS committed_demand numeric(14,4);
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'fk_productos_brand_id'
            ) THEN
                ALTER TABLE productos
                ADD CONSTRAINT fk_productos_brand_id
                FOREIGN KEY (brand_id) REFERENCES marcas(id)
                ON DELETE SET NULL;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'fk_productos_category_id'
            ) THEN
                ALTER TABLE productos
                ADD CONSTRAINT fk_productos_category_id
                FOREIGN KEY (category_id) REFERENCES categorias(id)
                ON DELETE SET NULL;
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        ALTER TABLE inventario
            ADD COLUMN IF NOT EXISTS notes text,
            ADD COLUMN IF NOT EXISTS inbound_real numeric(14,4),
            ADD COLUMN IF NOT EXISTS inbound_theoretical numeric(14,4),
            ADD COLUMN IF NOT EXISTS outbound_real numeric(14,4),
            ADD COLUMN IF NOT EXISTS outbound_theoretical numeric(14,4),
            ADD COLUMN IF NOT EXISTS nonconformity_adjustment numeric(14,4),
            ADD COLUMN IF NOT EXISTS min_stock numeric(14,4),
            ADD COLUMN IF NOT EXISTS arranged boolean,
            ADD COLUMN IF NOT EXISTS identified boolean,
            ADD COLUMN IF NOT EXISTS has_physical_diff boolean,
            ADD COLUMN IF NOT EXISTS purchase_exception_reason varchar(80);
        """
    )

    op.execute(
        """
        ALTER TABLE pedidos_clientes
            ADD COLUMN IF NOT EXISTS delivery_time_days integer,
            ADD COLUMN IF NOT EXISTS payment_time_days integer,
            ADD COLUMN IF NOT EXISTS preparation_time_days integer;
        """
    )

    op.execute(
        """
        ALTER TABLE movimientos_inventario
            ADD COLUMN IF NOT EXISTS movement_number varchar(80),
            ADD COLUMN IF NOT EXISTS qty_nonconformity numeric(14,4),
            ADD COLUMN IF NOT EXISTS observations text,
            ADD COLUMN IF NOT EXISTS goods_receipt_id uuid,
            ADD COLUMN IF NOT EXISTS quote_item_id uuid,
            ADD COLUMN IF NOT EXISTS nonconformity_id uuid,
            ADD COLUMN IF NOT EXISTS created_by_user_id uuid;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_movimientos_inventario_goods_receipt'
            ) THEN
                ALTER TABLE movimientos_inventario
                ADD CONSTRAINT fk_movimientos_inventario_goods_receipt
                FOREIGN KEY (goods_receipt_id) REFERENCES entradas_mercancia(id)
                ON DELETE SET NULL;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_movimientos_inventario_quote_item'
            ) THEN
                ALTER TABLE movimientos_inventario
                ADD CONSTRAINT fk_movimientos_inventario_quote_item
                FOREIGN KEY (quote_item_id) REFERENCES cotizacion_items(id)
                ON DELETE SET NULL;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_movimientos_inventario_nonconformity'
            ) THEN
                ALTER TABLE movimientos_inventario
                ADD CONSTRAINT fk_movimientos_inventario_nonconformity
                FOREIGN KEY (nonconformity_id) REFERENCES no_conformes(id)
                ON DELETE SET NULL;
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'cotizaciones' AND column_name = 'credit'
            ) THEN
                BEGIN
                    ALTER TABLE cotizaciones
                    ALTER COLUMN credit TYPE boolean
                    USING (CASE WHEN credit IS NULL THEN NULL ELSE (credit::numeric <> 0) END);
                EXCEPTION WHEN others THEN
                    NULL;
                END;
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        ALTER TABLE facturas_compras
            ADD COLUMN IF NOT EXISTS shipping_cost numeric(14,4),
            ADD COLUMN IF NOT EXISTS invoice_discount numeric(14,4);
        """
    )

    op.execute("ALTER TABLE facturas_compras DROP COLUMN IF EXISTS iva;")
    op.execute(
        """
        ALTER TABLE facturas_compras
        ADD COLUMN iva numeric(14,4)
        GENERATED ALWAYS AS (
            CASE
                WHEN subtotal IS NULL THEN NULL
                ELSE (subtotal + COALESCE(shipping_cost, 0)) * 0.16
            END
        ) STORED;
        """
    )
    op.execute("ALTER TABLE facturas_compras DROP COLUMN IF EXISTS total;")
    op.execute(
        """
        ALTER TABLE facturas_compras
        ADD COLUMN total numeric(14,4)
        GENERATED ALWAYS AS (
            CASE
                WHEN subtotal IS NULL THEN NULL
                ELSE (subtotal + COALESCE(shipping_cost, 0)) * 1.16
                    - COALESCE(invoice_discount, 0)
                    - COALESCE(shipping_insurance_discount, 0)
            END
        ) STORED;
        """
    )

    op.execute("ALTER TABLE gastos_operativos DROP COLUMN IF EXISTS iva;")
    op.execute(
        """
        ALTER TABLE gastos_operativos
        ADD COLUMN iva numeric(14,4)
        GENERATED ALWAYS AS (
            CASE WHEN subtotal IS NULL THEN NULL ELSE subtotal * 0.16 END
        ) STORED;
        """
    )
    op.execute("ALTER TABLE gastos_operativos DROP COLUMN IF EXISTS total;")
    op.execute(
        """
        ALTER TABLE gastos_operativos
        ADD COLUMN total numeric(14,4)
        GENERATED ALWAYS AS (
            CASE WHEN subtotal IS NULL THEN NULL ELSE subtotal * 1.16 END
        ) STORED;
        """
    )

    op.execute("ALTER TABLE ventas DROP COLUMN IF EXISTS total;")
    op.execute(
        """
        ALTER TABLE ventas
        ADD COLUMN total numeric(14,4)
        GENERATED ALWAYS AS (
            CASE WHEN subtotal IS NULL THEN NULL ELSE subtotal * 1.16 END
        ) STORED;
        """
    )
    op.execute("ALTER TABLE ventas DROP COLUMN IF EXISTS gross_margin;")
    op.execute(
        """
        ALTER TABLE ventas
        ADD COLUMN gross_margin numeric(14,4)
        GENERATED ALWAYS AS (
            CASE
                WHEN subtotal IS NULL OR purchase_cost IS NULL THEN NULL
                ELSE subtotal - purchase_cost
            END
        ) STORED;
        """
    )
    op.execute("ALTER TABLE ventas DROP COLUMN IF EXISTS margin_percent;")
    op.execute(
        """
        ALTER TABLE ventas
        ADD COLUMN margin_percent numeric(6,4)
        GENERATED ALWAYS AS (
            CASE
                WHEN subtotal IS NULL OR purchase_cost IS NULL THEN NULL
                ELSE (subtotal - purchase_cost) / NULLIF(subtotal, 0)
            END
        ) STORED;
        """
    )
    op.execute(
        "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS subtotal_in_po numeric(14,4);"
    )
    op.execute("ALTER TABLE ventas DROP COLUMN IF EXISTS diff_vs_po;")
    op.execute(
        """
        ALTER TABLE ventas
        ADD COLUMN diff_vs_po numeric(14,4)
        GENERATED ALWAYS AS (
            CASE
                WHEN subtotal IS NULL OR subtotal_in_po IS NULL THEN NULL
                ELSE subtotal - subtotal_in_po
            END
        ) STORED;
        """
    )
    op.execute("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS year_month varchar(20);")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ventas_year_month ON ventas (year_month);"
    )
    op.execute("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS quadrimester varchar(20);")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ventas_quadrimester ON ventas (quadrimester);"
    )

    op.execute("ALTER TABLE cotizaciones DROP COLUMN IF EXISTS subtotal_with_shipping;")
    op.execute(
        """
        ALTER TABLE cotizaciones
        ADD COLUMN subtotal_with_shipping numeric(14,4)
        GENERATED ALWAYS AS (
            (subtotal + COALESCE(shipping_cost, 0)) * (1 - COALESCE(discount, 0))
        ) STORED;
        """
    )
    op.execute("ALTER TABLE cotizaciones DROP COLUMN IF EXISTS monthly_interest;")
    op.execute(
        """
        ALTER TABLE cotizaciones
        ADD COLUMN monthly_interest numeric(8,6)
        GENERATED ALWAYS AS (
            CASE WHEN credit THEN 0.0175 ELSE 0 END
        ) STORED;
        """
    )
    op.execute("ALTER TABLE cotizaciones DROP COLUMN IF EXISTS total_interest;")
    op.execute(
        """
        ALTER TABLE cotizaciones
        ADD COLUMN total_interest numeric(8,6)
        GENERATED ALWAYS AS (
            CASE WHEN credit THEN 0.0175 * COALESCE(months, 0) ELSE 0 END
        ) STORED;
        """
    )
    op.execute("ALTER TABLE cotizaciones DROP COLUMN IF EXISTS total;")
    op.execute(
        """
        ALTER TABLE cotizaciones
        ADD COLUMN total numeric(14,4)
        GENERATED ALWAYS AS (
            CASE
                WHEN subtotal IS NULL THEN NULL
                WHEN credit THEN
                    ((subtotal + COALESCE(shipping_cost, 0)) * (1 - COALESCE(discount, 0)))
                    * (1 + (0.0175 * COALESCE(months, 0))) * 1.16
                ELSE
                    ((subtotal + COALESCE(shipping_cost, 0)) * (1 - COALESCE(discount, 0))) * 1.16
            END
        ) STORED;
        """
    )

    op.execute("ALTER TABLE cotizacion_items DROP COLUMN IF EXISTS qty_missing;")
    op.execute(
        """
        ALTER TABLE cotizacion_items
        ADD COLUMN qty_missing numeric(14,4)
        GENERATED ALWAYS AS (
            CASE
                WHEN qty_requested IS NULL THEN NULL
                ELSE qty_requested - COALESCE(qty_packed, 0)
            END
        ) STORED;
        """
    )
    op.execute("ALTER TABLE cotizacion_items DROP COLUMN IF EXISTS subtotal;")
    op.execute(
        """
        ALTER TABLE cotizacion_items
        ADD COLUMN subtotal numeric(14,4)
        GENERATED ALWAYS AS (
            CASE
                WHEN qty_requested IS NULL OR unit_cost_sale IS NULL THEN NULL
                ELSE qty_requested * unit_cost_sale
            END
        ) STORED;
        """
    )
    op.execute("ALTER TABLE cotizacion_items DROP COLUMN IF EXISTS purchase_subtotal;")
    op.execute(
        """
        ALTER TABLE cotizacion_items
        ADD COLUMN purchase_subtotal numeric(14,4)
        GENERATED ALWAYS AS (
            CASE
                WHEN qty_requested IS NULL OR unit_cost_purchase IS NULL THEN NULL
                ELSE qty_requested * unit_cost_purchase
            END
        ) STORED;
        """
    )

    op.execute(
        "ALTER TABLE solicitudes_material ADD COLUMN IF NOT EXISTS is_packaged boolean;"
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'solicitudes_material'
                  AND column_name = 'package_size'
            ) THEN
                BEGIN
                    ALTER TABLE solicitudes_material
                    ALTER COLUMN package_size TYPE numeric(10,2)
                    USING NULLIF(regexp_replace(package_size, '[^0-9\\.]', '', 'g'), '')::numeric;
                EXCEPTION WHEN others THEN
                    ALTER TABLE solicitudes_material
                    ALTER COLUMN package_size TYPE numeric(10,2)
                    USING NULL;
                END;
            END IF;
        END $$;
        """
    )
    op.execute(
        "ALTER TABLE solicitudes_material DROP COLUMN IF EXISTS qty_requested_converted;"
    )
    op.execute(
        """
        ALTER TABLE solicitudes_material
        ADD COLUMN qty_requested_converted numeric(14,4)
        GENERATED ALWAYS AS (
            CASE
                WHEN is_packaged THEN qty_requested / NULLIF(package_size, 0)
                ELSE qty_requested
            END
        ) STORED;
        """
    )
    op.execute("ALTER TABLE solicitudes_material DROP COLUMN IF EXISTS total_amount;")
    op.execute(
        """
        ALTER TABLE solicitudes_material
        ADD COLUMN total_amount numeric(14,4)
        GENERATED ALWAYS AS (
            CASE
                WHEN unit_cost IS NULL OR qty_requested IS NULL THEN NULL
                ELSE unit_cost * qty_requested
            END
        ) STORED;
        """
    )

    op.execute(
        "ALTER TABLE entradas_mercancia ADD COLUMN IF NOT EXISTS is_packaged boolean;"
    )
    op.execute(
        "ALTER TABLE entradas_mercancia ADD COLUMN IF NOT EXISTS package_size numeric(10,2);"
    )
    op.execute(
        """
        UPDATE entradas_mercancia
        SET
            is_packaged = COALESCE(is_packaged, (tdp IS NOT NULL AND btrim(tdp) <> '')),
            package_size = COALESCE(
                package_size,
                NULLIF(regexp_replace(tdp, '[^0-9\\.]', '', 'g'), '')::numeric
            )
        WHERE tdp IS NOT NULL;
        """
    )
    op.execute("ALTER TABLE entradas_mercancia DROP COLUMN IF EXISTS total_cost;")
    op.execute(
        """
        ALTER TABLE entradas_mercancia
        ADD COLUMN total_cost numeric(14,4)
        GENERATED ALWAYS AS (
            CASE
                WHEN unit_cost IS NULL OR qty_requested IS NULL THEN NULL
                ELSE unit_cost * qty_requested
            END
        ) STORED;
        """
    )
    op.execute("ALTER TABLE entradas_mercancia DROP COLUMN IF EXISTS delivery_percent;")
    op.execute(
        """
        ALTER TABLE entradas_mercancia
        ADD COLUMN delivery_percent numeric(6,4)
        GENERATED ALWAYS AS (
            CASE
                WHEN qty_arrived IS NULL OR qty_requested IS NULL THEN NULL
                ELSE qty_arrived / NULLIF(qty_requested, 0)
            END
        ) STORED;
        """
    )
    op.execute(
        "ALTER TABLE entradas_mercancia DROP COLUMN IF EXISTS qty_requested_converted;"
    )
    op.execute(
        """
        ALTER TABLE entradas_mercancia
        ADD COLUMN qty_requested_converted numeric(14,4)
        GENERATED ALWAYS AS (
            CASE
                WHEN is_packaged THEN qty_requested * COALESCE(package_size, 1)
                ELSE qty_requested
            END
        ) STORED;
        """
    )

    op.execute("ALTER TABLE no_conformes DROP COLUMN IF EXISTS inventory_adjustment;")
    op.execute(
        """
        ALTER TABLE no_conformes
        ADD COLUMN inventory_adjustment numeric(14,4)
        GENERATED ALWAYS AS (
            CASE
                WHEN quantity IS NULL THEN NULL
                WHEN action_taken = 'Reingreso a inventario' THEN quantity
                WHEN action_taken = 'Ajuste' THEN
                    CASE
                        WHEN adjustment_type = 'Entrada' THEN quantity
                        WHEN adjustment_type = 'Salida' THEN -quantity
                        ELSE -quantity
                    END
                ELSE -quantity
            END
        ) STORED;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE no_conformes DROP COLUMN IF EXISTS inventory_adjustment;")
    op.execute(
        "ALTER TABLE entradas_mercancia DROP COLUMN IF EXISTS qty_requested_converted;"
    )
    op.execute("ALTER TABLE entradas_mercancia DROP COLUMN IF EXISTS delivery_percent;")
    op.execute("ALTER TABLE entradas_mercancia DROP COLUMN IF EXISTS total_cost;")
    op.execute("ALTER TABLE solicitudes_material DROP COLUMN IF EXISTS total_amount;")
    op.execute(
        "ALTER TABLE solicitudes_material DROP COLUMN IF EXISTS qty_requested_converted;"
    )
    op.execute("ALTER TABLE cotizacion_items DROP COLUMN IF EXISTS purchase_subtotal;")
    op.execute("ALTER TABLE cotizacion_items DROP COLUMN IF EXISTS subtotal;")
    op.execute("ALTER TABLE cotizacion_items DROP COLUMN IF EXISTS qty_missing;")
    op.execute("ALTER TABLE cotizaciones DROP COLUMN IF EXISTS total;")
    op.execute("ALTER TABLE cotizaciones DROP COLUMN IF EXISTS total_interest;")
    op.execute("ALTER TABLE cotizaciones DROP COLUMN IF EXISTS monthly_interest;")
    op.execute("ALTER TABLE cotizaciones DROP COLUMN IF EXISTS subtotal_with_shipping;")
    op.execute("DROP INDEX IF EXISTS ix_ventas_quadrimester;")
    op.execute("ALTER TABLE ventas DROP COLUMN IF EXISTS quadrimester;")
    op.execute("DROP INDEX IF EXISTS ix_ventas_year_month;")
    op.execute("ALTER TABLE ventas DROP COLUMN IF EXISTS year_month;")
    op.execute("ALTER TABLE ventas DROP COLUMN IF EXISTS diff_vs_po;")
    op.execute("ALTER TABLE ventas DROP COLUMN IF EXISTS margin_percent;")
    op.execute("ALTER TABLE ventas DROP COLUMN IF EXISTS gross_margin;")
    op.execute("ALTER TABLE ventas DROP COLUMN IF EXISTS total;")
    op.execute("ALTER TABLE gastos_operativos DROP COLUMN IF EXISTS total;")
    op.execute("ALTER TABLE gastos_operativos DROP COLUMN IF EXISTS iva;")
    op.execute("ALTER TABLE facturas_compras DROP COLUMN IF EXISTS total;")
    op.execute("ALTER TABLE facturas_compras DROP COLUMN IF EXISTS iva;")

    op.execute(
        """
        ALTER TABLE movimientos_inventario
            DROP COLUMN IF EXISTS created_by_user_id,
            DROP COLUMN IF EXISTS nonconformity_id,
            DROP COLUMN IF EXISTS quote_item_id,
            DROP COLUMN IF EXISTS goods_receipt_id,
            DROP COLUMN IF EXISTS observations,
            DROP COLUMN IF EXISTS qty_nonconformity,
            DROP COLUMN IF EXISTS movement_number;
        """
    )
    op.execute(
        """
        ALTER TABLE pedidos_clientes
            DROP COLUMN IF EXISTS preparation_time_days,
            DROP COLUMN IF EXISTS payment_time_days,
            DROP COLUMN IF EXISTS delivery_time_days;
        """
    )
    op.execute(
        """
        ALTER TABLE inventario
            DROP COLUMN IF EXISTS purchase_exception_reason,
            DROP COLUMN IF EXISTS has_physical_diff,
            DROP COLUMN IF EXISTS identified,
            DROP COLUMN IF EXISTS arranged,
            DROP COLUMN IF EXISTS min_stock,
            DROP COLUMN IF EXISTS nonconformity_adjustment,
            DROP COLUMN IF EXISTS outbound_theoretical,
            DROP COLUMN IF EXISTS outbound_real,
            DROP COLUMN IF EXISTS inbound_theoretical,
            DROP COLUMN IF EXISTS inbound_real,
            DROP COLUMN IF EXISTS notes;
        """
    )
    op.execute(
        """
        ALTER TABLE productos
            DROP COLUMN IF EXISTS committed_demand,
            DROP COLUMN IF EXISTS last_outbound_date,
            DROP COLUMN IF EXISTS demand_180_days,
            DROP COLUMN IF EXISTS demand_90_days,
            DROP COLUMN IF EXISTS total_accumulated_sales,
            DROP COLUMN IF EXISTS real_outflow,
            DROP COLUMN IF EXISTS theoretical_outflow,
            DROP COLUMN IF EXISTS unit_price_base,
            DROP COLUMN IF EXISTS is_internal,
            DROP COLUMN IF EXISTS datasheet_url,
            DROP COLUMN IF EXISTS image_url,
            DROP COLUMN IF EXISTS warehouse_location,
            DROP COLUMN IF EXISTS category_id,
            DROP COLUMN IF EXISTS brand_id,
            DROP COLUMN IF EXISTS sat_code;
        """
    )

    op.execute("DROP TABLE IF EXISTS marcas;")
    op.execute("DROP TABLE IF EXISTS categorias;")

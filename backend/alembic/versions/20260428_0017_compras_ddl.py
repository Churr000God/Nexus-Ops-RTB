"""compras: DDL completo del módulo de Compras

Cambios DDL:
  1.  CREATE TABLE sat_payment_forms        — catálogo SAT c_FormaPago
  2.  CREATE TABLE sat_payment_methods      — catálogo SAT c_MetodoPago (PUE/PPD)
  3.  CREATE TABLE purchase_requests        — solicitudes de material (cabecera)
  4.  CREATE TABLE purchase_request_items   — partidas de solicitud
  5.  CREATE TABLE purchase_orders          — órdenes de compra (cabecera)
  6.  CREATE TABLE purchase_order_items     — partidas de OC
  7.  CREATE TABLE goods_receipts           — recepciones de mercancía (cabecera)
  8.  CREATE TABLE goods_receipt_items      — partidas de recepción
  9.  CREATE TABLE supplier_invoices        — facturas del proveedor (cabecera)
  10. CREATE TABLE supplier_invoice_items   — partidas de factura de proveedor
  11. ALTER TABLE gastos_operativos         — agrega campos SAT y uuid_sat

Revision ID: 20260428_0017
Revises: 20260428_0016
Create Date: 2026-04-28
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260428_0017"
down_revision: str = "20260428_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1. sat_payment_forms ──────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE sat_payment_forms (
            form_id         TEXT PRIMARY KEY,
            description     TEXT NOT NULL,
            is_active       BOOLEAN NOT NULL DEFAULT TRUE
        )
    """)

    # ── 2. sat_payment_methods ────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE sat_payment_methods (
            method_id       TEXT PRIMARY KEY,
            description     TEXT NOT NULL,
            is_credit       BOOLEAN NOT NULL GENERATED ALWAYS AS (method_id = 'PPD') STORED,
            is_active       BOOLEAN NOT NULL DEFAULT TRUE
        )
    """)

    # ── 3. purchase_requests ──────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE purchase_requests (
            request_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            request_number  TEXT NOT NULL UNIQUE,
            requested_by    UUID REFERENCES users(id) ON DELETE SET NULL,
            request_date    DATE NOT NULL DEFAULT CURRENT_DATE,
            status          TEXT NOT NULL DEFAULT 'DRAFT'
                                CHECK (status IN ('DRAFT','APPROVED','PARTIALLY_ORDERED',
                                                  'ORDERED','REJECTED','CANCELLED')),
            notes           TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX ix_purchase_requests_status ON purchase_requests(status)")
    op.execute("CREATE INDEX ix_purchase_requests_request_date ON purchase_requests(request_date)")

    # ── 4. purchase_request_items ─────────────────────────────────────────────
    op.execute("""
        CREATE TABLE purchase_request_items (
            request_item_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            request_id              BIGINT NOT NULL REFERENCES purchase_requests(request_id) ON DELETE CASCADE,
            line_number             SMALLINT NOT NULL,
            item_type               TEXT NOT NULL
                                        CHECK (item_type IN ('GOODS_RESALE','GOODS_INTERNAL','SERVICE')),
            product_id              UUID REFERENCES productos(id) ON DELETE SET NULL,
            service_description     TEXT,
            unit_of_measure         TEXT,
            quantity_requested      NUMERIC(14,4) NOT NULL,
            quantity_ordered        NUMERIC(14,4) NOT NULL DEFAULT 0,
            suggested_supplier_id   BIGINT REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
            quote_item_id           BIGINT REFERENCES quote_items(quote_item_id) ON DELETE SET NULL,
            in_package              BOOLEAN NOT NULL DEFAULT FALSE,
            exception_reason        TEXT,
            notes                   TEXT,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_pri_product_or_service CHECK (
                (item_type IN ('GOODS_RESALE','GOODS_INTERNAL') AND product_id IS NOT NULL)
                OR (item_type = 'SERVICE' AND service_description IS NOT NULL)
            ),
            UNIQUE (request_id, line_number)
        )
    """)
    op.execute("CREATE INDEX ix_pri_request_id ON purchase_request_items(request_id)")
    op.execute("CREATE INDEX ix_pri_product_id ON purchase_request_items(product_id)")

    # ── 5. purchase_orders ────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE purchase_orders (
            po_id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            po_number               TEXT NOT NULL UNIQUE,
            supplier_id             BIGINT NOT NULL REFERENCES suppliers(supplier_id) ON DELETE RESTRICT,
            po_type                 TEXT NOT NULL DEFAULT 'GOODS'
                                        CHECK (po_type IN ('GOODS','SERVICES','MIXED')),
            status                  TEXT NOT NULL DEFAULT 'DRAFT'
                                        CHECK (status IN ('DRAFT','SENT','CONFIRMED',
                                                          'PARTIAL_RECEIVED','RECEIVED',
                                                          'INVOICED','PAID','CANCELLED')),
            collection_status       TEXT,
            issue_date              DATE,
            sent_date               DATE,
            confirmation_date       DATE,
            estimated_pickup_date   DATE,
            pickup_date             DATE,
            is_confirmed            BOOLEAN NOT NULL DEFAULT FALSE,
            is_email_sent           BOOLEAN NOT NULL DEFAULT FALSE,
            is_printed              BOOLEAN NOT NULL DEFAULT FALSE,
            follow_up_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
            currency                TEXT NOT NULL DEFAULT 'MXN',
            exchange_rate           NUMERIC(10,6) NOT NULL DEFAULT 1,
            subtotal                NUMERIC(14,4),
            tax_amount              NUMERIC(14,4),
            shipping_amount         NUMERIC(14,4),
            total                   NUMERIC(14,4),
            notes                   TEXT,
            created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX ix_purchase_orders_supplier ON purchase_orders(supplier_id)")
    op.execute("CREATE INDEX ix_purchase_orders_status ON purchase_orders(status)")
    op.execute("CREATE INDEX ix_purchase_orders_issue_date ON purchase_orders(issue_date)")

    # ── 6. purchase_order_items ───────────────────────────────────────────────
    op.execute("""
        CREATE TABLE purchase_order_items (
            po_item_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            po_id                   BIGINT NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
            line_number             SMALLINT NOT NULL,
            request_item_id         BIGINT REFERENCES purchase_request_items(request_item_id) ON DELETE SET NULL,
            item_type               TEXT NOT NULL
                                        CHECK (item_type IN ('GOODS_RESALE','GOODS_INTERNAL','SERVICE')),
            product_id              UUID REFERENCES productos(id) ON DELETE SET NULL,
            service_description     TEXT,
            unit_of_measure         TEXT,
            quantity_ordered        NUMERIC(14,4) NOT NULL,
            quantity_received       NUMERIC(14,4) NOT NULL DEFAULT 0,
            unit_cost               NUMERIC(14,4),
            tax_pct                 NUMERIC(6,4) NOT NULL DEFAULT 16,
            subtotal                NUMERIC(14,4) GENERATED ALWAYS AS
                                        (CASE WHEN unit_cost IS NULL OR quantity_ordered IS NULL THEN NULL
                                              ELSE quantity_ordered * unit_cost END) STORED,
            notes                   TEXT,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_poi_product_or_service CHECK (
                (item_type IN ('GOODS_RESALE','GOODS_INTERNAL') AND product_id IS NOT NULL)
                OR (item_type = 'SERVICE' AND service_description IS NOT NULL)
            ),
            UNIQUE (po_id, line_number)
        )
    """)
    op.execute("CREATE INDEX ix_poi_po_id ON purchase_order_items(po_id)")
    op.execute("CREATE INDEX ix_poi_request_item_id ON purchase_order_items(request_item_id)")
    op.execute("CREATE INDEX ix_poi_product_id ON purchase_order_items(product_id)")

    # ── 7. goods_receipts ─────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE goods_receipts (
            receipt_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            receipt_number          TEXT NOT NULL UNIQUE,
            po_id                   BIGINT NOT NULL REFERENCES purchase_orders(po_id) ON DELETE RESTRICT,
            supplier_invoice_id     BIGINT,
            supplier_id             BIGINT NOT NULL REFERENCES suppliers(supplier_id) ON DELETE RESTRICT,
            receipt_date            DATE NOT NULL DEFAULT CURRENT_DATE,
            physical_validation     BOOLEAN NOT NULL DEFAULT FALSE,
            validated_by            UUID REFERENCES users(id) ON DELETE SET NULL,
            validated_at            TIMESTAMPTZ,
            delivery_pct            NUMERIC(6,4),
            notes                   TEXT,
            created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX ix_goods_receipts_po_id ON goods_receipts(po_id)")
    op.execute("CREATE INDEX ix_goods_receipts_supplier ON goods_receipts(supplier_id)")
    op.execute("CREATE INDEX ix_goods_receipts_date ON goods_receipts(receipt_date)")

    # ── 8. goods_receipt_items ────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE goods_receipt_items (
            receipt_item_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            receipt_id              BIGINT NOT NULL REFERENCES goods_receipts(receipt_id) ON DELETE CASCADE,
            po_item_id              BIGINT NOT NULL REFERENCES purchase_order_items(po_item_id) ON DELETE RESTRICT,
            line_number             SMALLINT NOT NULL,
            product_id              UUID REFERENCES productos(id) ON DELETE SET NULL,
            quantity_requested      NUMERIC(14,4) NOT NULL,
            quantity_received       NUMERIC(14,4) NOT NULL,
            unit_cost               NUMERIC(14,4),
            notes                   TEXT,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (receipt_id, line_number)
        )
    """)
    op.execute("CREATE INDEX ix_gri_receipt_id ON goods_receipt_items(receipt_id)")
    op.execute("CREATE INDEX ix_gri_po_item_id ON goods_receipt_items(po_item_id)")
    op.execute("CREATE INDEX ix_gri_product_id ON goods_receipt_items(product_id)")

    # ── 9. supplier_invoices ──────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE supplier_invoices (
            invoice_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            invoice_number          TEXT NOT NULL,
            supplier_id             BIGINT NOT NULL REFERENCES suppliers(supplier_id) ON DELETE RESTRICT,
            po_id                   BIGINT REFERENCES purchase_orders(po_id) ON DELETE SET NULL,
            invoice_type            TEXT NOT NULL DEFAULT 'GOODS'
                                        CHECK (invoice_type IN ('GOODS','SERVICES','MIXED')),
            invoice_date            DATE NOT NULL,
            received_date           DATE,
            status                  TEXT NOT NULL DEFAULT 'RECEIVED'
                                        CHECK (status IN ('RECEIVED','VALIDATED','PAID','CANCELLED')),
            payment_status          TEXT NOT NULL DEFAULT 'UNPAID'
                                        CHECK (payment_status IN ('UNPAID','PARTIAL','PAID')),
            payment_date            DATE,
            sat_payment_form_id     TEXT REFERENCES sat_payment_forms(form_id) ON DELETE SET NULL,
            sat_payment_method_id   TEXT REFERENCES sat_payment_methods(method_id) ON DELETE SET NULL,
            is_credit               BOOLEAN GENERATED ALWAYS AS
                                        (sat_payment_method_id = 'PPD') STORED,
            uuid_sat                TEXT,
            subtotal                NUMERIC(14,4),
            tax_amount              NUMERIC(14,4),
            shipping_amount         NUMERIC(14,4),
            discount_amount         NUMERIC(14,4),
            total                   NUMERIC(14,4),
            currency                TEXT NOT NULL DEFAULT 'MXN',
            exchange_rate           NUMERIC(10,6) NOT NULL DEFAULT 1,
            notes                   TEXT,
            created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (supplier_id, invoice_number)
        )
    """)
    op.execute("CREATE INDEX ix_supplier_invoices_supplier ON supplier_invoices(supplier_id)")
    op.execute("CREATE INDEX ix_supplier_invoices_po_id ON supplier_invoices(po_id)")
    op.execute("CREATE INDEX ix_supplier_invoices_status ON supplier_invoices(status)")
    op.execute("CREATE INDEX ix_supplier_invoices_payment_status ON supplier_invoices(payment_status)")
    op.execute("CREATE INDEX ix_supplier_invoices_date ON supplier_invoices(invoice_date)")

    # Agregar FK diferida goods_receipts → supplier_invoices
    op.execute("""
        ALTER TABLE goods_receipts
            ADD CONSTRAINT fk_gr_supplier_invoice
                FOREIGN KEY (supplier_invoice_id)
                REFERENCES supplier_invoices(invoice_id) ON DELETE SET NULL
    """)

    # ── 10. supplier_invoice_items ────────────────────────────────────────────
    op.execute("""
        CREATE TABLE supplier_invoice_items (
            invoice_item_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            invoice_id              BIGINT NOT NULL REFERENCES supplier_invoices(invoice_id) ON DELETE CASCADE,
            po_item_id              BIGINT REFERENCES purchase_order_items(po_item_id) ON DELETE SET NULL,
            receipt_item_id         BIGINT REFERENCES goods_receipt_items(receipt_item_id) ON DELETE SET NULL,
            line_number             SMALLINT NOT NULL,
            item_type               TEXT NOT NULL DEFAULT 'GOODS_RESALE'
                                        CHECK (item_type IN ('GOODS_RESALE','GOODS_INTERNAL','SERVICE')),
            product_id              UUID REFERENCES productos(id) ON DELETE SET NULL,
            concept_description     TEXT,
            unit_of_measure         TEXT,
            quantity                NUMERIC(14,4) NOT NULL,
            unit_cost               NUMERIC(14,4),
            tax_pct                 NUMERIC(6,4) NOT NULL DEFAULT 16,
            subtotal                NUMERIC(14,4) GENERATED ALWAYS AS
                                        (CASE WHEN unit_cost IS NULL OR quantity IS NULL THEN NULL
                                              ELSE quantity * unit_cost END) STORED,
            notes                   TEXT,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_sii_product_or_service CHECK (
                (item_type IN ('GOODS_RESALE','GOODS_INTERNAL') AND product_id IS NOT NULL)
                OR (item_type = 'SERVICE' AND concept_description IS NOT NULL)
            ),
            UNIQUE (invoice_id, line_number)
        )
    """)
    op.execute("CREATE INDEX ix_sii_invoice_id ON supplier_invoice_items(invoice_id)")
    op.execute("CREATE INDEX ix_sii_product_id ON supplier_invoice_items(product_id)")

    # ── 11. ALTER gastos_operativos — agregar campos SAT ──────────────────────
    op.execute("""
        ALTER TABLE gastos_operativos
            ADD COLUMN IF NOT EXISTS sat_payment_form_id   TEXT
                REFERENCES sat_payment_forms(form_id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS sat_payment_method_id TEXT
                REFERENCES sat_payment_methods(method_id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS uuid_sat              TEXT,
            ADD COLUMN IF NOT EXISTS expense_number        TEXT UNIQUE,
            ADD COLUMN IF NOT EXISTS responsible_user_id   UUID
                REFERENCES users(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS tax_amount            NUMERIC(14,4)
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE gastos_operativos DROP COLUMN IF EXISTS tax_amount")
    op.execute("ALTER TABLE gastos_operativos DROP COLUMN IF EXISTS responsible_user_id")
    op.execute("ALTER TABLE gastos_operativos DROP COLUMN IF EXISTS expense_number")
    op.execute("ALTER TABLE gastos_operativos DROP COLUMN IF EXISTS uuid_sat")
    op.execute("ALTER TABLE gastos_operativos DROP COLUMN IF EXISTS sat_payment_method_id")
    op.execute("ALTER TABLE gastos_operativos DROP COLUMN IF EXISTS sat_payment_form_id")
    op.execute("ALTER TABLE goods_receipts DROP CONSTRAINT IF EXISTS fk_gr_supplier_invoice")
    op.execute("DROP TABLE IF EXISTS supplier_invoice_items CASCADE")
    op.execute("DROP TABLE IF EXISTS supplier_invoices CASCADE")
    op.execute("DROP TABLE IF EXISTS goods_receipt_items CASCADE")
    op.execute("DROP TABLE IF EXISTS goods_receipts CASCADE")
    op.execute("DROP TABLE IF EXISTS purchase_order_items CASCADE")
    op.execute("DROP TABLE IF EXISTS purchase_orders CASCADE")
    op.execute("DROP TABLE IF EXISTS purchase_request_items CASCADE")
    op.execute("DROP TABLE IF EXISTS purchase_requests CASCADE")
    op.execute("DROP TABLE IF EXISTS sat_payment_methods CASCADE")
    op.execute("DROP TABLE IF EXISTS sat_payment_forms CASCADE")

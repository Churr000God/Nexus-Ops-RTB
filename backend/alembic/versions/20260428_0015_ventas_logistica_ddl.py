"""ventas_logistica: DDL completo del módulo Ventas y Logística

Cambios DDL (todas antes de los datos, por regla del proyecto):
  1.  CREATE TABLE carriers                  — catálogo de fleteras propias y externas
  2.  CREATE TABLE delivery_notes            — notas de remisión informales
  3.  CREATE TABLE delivery_note_items       — partidas de notas de remisión
  4.  CREATE TABLE quotes                    — cotizaciones formales (flujo operativo)
  5.  CREATE TABLE quote_items               — partidas de cotizaciones
  6.  CREATE TABLE quote_status_history      — historial de cambios de estatus
  7.  CREATE TABLE quote_delivery_notes      — tabla puente NR ↔ cotización (N:N)
  8.  CREATE TABLE orders                    — pedidos formales de clientes
  9.  CREATE TABLE order_items               — partidas de pedidos
  10. CREATE TABLE order_milestones          — hitos del pedido
  11. CREATE TABLE cfdi                      — comprobantes fiscales digitales
  12. CREATE TABLE cfdi_items                ��� partidas del CFDI
  13. CREATE TABLE cfdi_credit_notes         — notas de crédito (tipo E)
  14. CREATE TABLE cfdi_payments             — complementos de pago
  15. CREATE TABLE payments                  — pagos recibidos de clientes
  16. CREATE TABLE payment_applications      — aplicación de pago a order/CFDI
  17. CREATE TABLE shipments                 — envíos físicos
  18. CREATE TABLE shipment_items            — partidas del envío
  19. CREATE TABLE shipment_tracking_events  — eventos de tracking
  20. CREATE TABLE routes                    — planeación de rutas del día
  21. CREATE TABLE route_stops               — paradas (DELIVERY | PICKUP)

Revision ID: 20260428_0015
Revises: 20260428_0014
Create Date: 2026-04-28
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260428_0015"
down_revision: str = "20260428_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1. carriers ───────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE carriers (
            carrier_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            code                    TEXT NOT NULL UNIQUE,
            name                    TEXT NOT NULL,
            contact_name            TEXT,
            phone                   TEXT,
            email                   TEXT,
            tracking_url_template   TEXT,
            is_internal             BOOLEAN NOT NULL DEFAULT FALSE,
            is_active               BOOLEAN NOT NULL DEFAULT TRUE,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── 2. delivery_notes ───────────────────��──────────────────────────���──────
    op.execute("""
        CREATE TABLE delivery_notes (
            delivery_note_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            note_number         TEXT NOT NULL UNIQUE,
            customer_id         BIGINT NOT NULL REFERENCES customers(customer_id),
            shipping_address_id BIGINT REFERENCES customer_addresses(address_id),
            sales_rep_id        UUID REFERENCES users(id),
            issue_date          DATE NOT NULL DEFAULT CURRENT_DATE,
            delivery_date       DATE,
            status              TEXT NOT NULL DEFAULT 'DRAFT'
                CHECK (status IN ('DRAFT','ISSUED','DELIVERED','TRANSFORMED',
                                  'PARTIALLY_INVOICED','INVOICED','CANCELLED')),
            customer_po_number  TEXT,
            customer_po_date    DATE,
            subtotal            NUMERIC(14,4) NOT NULL DEFAULT 0,
            tax_amount          NUMERIC(14,4) NOT NULL DEFAULT 0,
            total               NUMERIC(14,4) NOT NULL DEFAULT 0,
            notes               TEXT,
            cancelled_at        TIMESTAMPTZ,
            cancellation_reason TEXT,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── 3. delivery_note_items ──────────────────────���─────────────────────────
    op.execute("""
        CREATE TABLE delivery_note_items (
            item_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            delivery_note_id    BIGINT NOT NULL
                REFERENCES delivery_notes(delivery_note_id) ON DELETE CASCADE,
            product_id          UUID REFERENCES productos(id) ON DELETE SET NULL,
            sku                 TEXT,
            description         TEXT NOT NULL,
            quantity            NUMERIC(14,4) NOT NULL DEFAULT 1,
            unit_price          NUMERIC(14,4) NOT NULL DEFAULT 0,
            discount_amount     NUMERIC(14,4) NOT NULL DEFAULT 0,
            tax_rate            NUMERIC(6,4)  NOT NULL DEFAULT 0.16,
            subtotal            NUMERIC(14,4) NOT NULL DEFAULT 0,
            tax_amount          NUMERIC(14,4) NOT NULL DEFAULT 0,
            total               NUMERIC(14,4) NOT NULL DEFAULT 0,
            notes               TEXT,
            sort_order          SMALLINT NOT NULL DEFAULT 0,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── 4. quotes ──────────────────���─────────────────────────────────��────────
    op.execute("""
        CREATE TABLE quotes (
            quote_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            quote_number        TEXT NOT NULL UNIQUE,
            customer_id         BIGINT NOT NULL REFERENCES customers(customer_id),
            sales_rep_id        UUID REFERENCES users(id),
            status              TEXT NOT NULL DEFAULT 'DRAFT'
                CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED',
                                  'EXPIRED','CANCELLED')),
            issue_date          DATE NOT NULL DEFAULT CURRENT_DATE,
            expiry_date         DATE,
            customer_po_number  TEXT,
            customer_po_date    DATE,
            currency            TEXT NOT NULL DEFAULT 'MXN',
            exchange_rate       NUMERIC(10,6) NOT NULL DEFAULT 1,
            payment_terms       TEXT,
            shipping_address_id BIGINT REFERENCES customer_addresses(address_id),
            subtotal            NUMERIC(14,4) NOT NULL DEFAULT 0,
            tax_amount          NUMERIC(14,4) NOT NULL DEFAULT 0,
            total               NUMERIC(14,4) NOT NULL DEFAULT 0,
            notes               TEXT,
            internal_notes      TEXT,
            approved_by         UUID REFERENCES users(id),
            approved_at         TIMESTAMPTZ,
            rejected_by         UUID REFERENCES users(id),
            rejected_at         TIMESTAMPTZ,
            rejection_reason    TEXT,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── 5. quote_items ──────────────────────────────────────────────────────��─
    op.execute("""
        CREATE TABLE quote_items (
            quote_item_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            quote_id                BIGINT NOT NULL
                REFERENCES quotes(quote_id) ON DELETE CASCADE,
            product_id              UUID REFERENCES productos(id) ON DELETE SET NULL,
            delivery_note_item_id   BIGINT
                REFERENCES delivery_note_items(item_id) ON DELETE SET NULL,
            sku                     TEXT,
            description             TEXT NOT NULL,
            quantity                NUMERIC(14,4) NOT NULL DEFAULT 1,
            unit_price              NUMERIC(14,4) NOT NULL DEFAULT 0,
            discount_pct            NUMERIC(6,4)  NOT NULL DEFAULT 0,
            tax_rate                NUMERIC(6,4)  NOT NULL DEFAULT 0.16,
            subtotal                NUMERIC(14,4) NOT NULL DEFAULT 0,
            tax_amount              NUMERIC(14,4) NOT NULL DEFAULT 0,
            total                   NUMERIC(14,4) NOT NULL DEFAULT 0,
            notes                   TEXT,
            sort_order              SMALLINT NOT NULL DEFAULT 0,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── 6. quote_status_history ────────────────���──────────────────────────────
    op.execute("""
        CREATE TABLE quote_status_history (
            history_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            quote_id    BIGINT NOT NULL
                REFERENCES quotes(quote_id) ON DELETE CASCADE,
            from_status TEXT,
            to_status   TEXT NOT NULL,
            changed_by  UUID REFERENCES users(id),
            changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            notes       TEXT
        )
    """)

    # ── 7. quote_delivery_notes (N:N bridge) ──────────────────────────────────
    op.execute("""
        CREATE TABLE quote_delivery_notes (
            quote_id            BIGINT NOT NULL
                REFERENCES quotes(quote_id) ON DELETE CASCADE,
            delivery_note_id    BIGINT NOT NULL
                REFERENCES delivery_notes(delivery_note_id),
            associated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            associated_by       UUID REFERENCES users(id),
            notes               TEXT,
            PRIMARY KEY (quote_id, delivery_note_id)
        )
    """)

    # ── 8. orders ───────────────────��───────────────────────────────────��─────
    op.execute("""
        CREATE TABLE orders (
            order_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            order_number            TEXT NOT NULL UNIQUE,
            quote_id                BIGINT REFERENCES quotes(quote_id),
            customer_id             BIGINT NOT NULL REFERENCES customers(customer_id),
            sales_rep_id            UUID REFERENCES users(id),
            packer_id               UUID REFERENCES users(id),
            status                  TEXT NOT NULL DEFAULT 'CREATED'
                CHECK (status IN (
                    'CREATED','CONFIRMED','IN_PRODUCTION','READY_TO_SHIP',
                    'PARTIALLY_SHIPPED','SHIPPED','DELIVERED',
                    'INVOICED','PARTIALLY_PAID','PAID','CANCELLED'
                )),
            packing_status          TEXT NOT NULL DEFAULT 'NOT_STARTED'
                CHECK (packing_status IN (
                    'NOT_STARTED','IN_PROGRESS','READY',
                    'PACKED_FOR_ROUTE','DISPATCHED'
                )),
            order_date              DATE NOT NULL DEFAULT CURRENT_DATE,
            requested_delivery_date DATE,
            delivery_date           DATE,
            shipping_address_id     BIGINT REFERENCES customer_addresses(address_id),
            currency                TEXT NOT NULL DEFAULT 'MXN',
            exchange_rate           NUMERIC(10,6) NOT NULL DEFAULT 1,
            payment_terms           TEXT,
            subtotal                NUMERIC(14,4) NOT NULL DEFAULT 0,
            tax_amount              NUMERIC(14,4) NOT NULL DEFAULT 0,
            total                   NUMERIC(14,4) NOT NULL DEFAULT 0,
            amount_paid             NUMERIC(14,4) NOT NULL DEFAULT 0,
            notes                   TEXT,
            internal_notes          TEXT,
            cancelled_at            TIMESTAMPTZ,
            cancellation_reason     TEXT,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── 9. order_items ────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE order_items (
            order_item_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            order_id        BIGINT NOT NULL
                REFERENCES orders(order_id) ON DELETE CASCADE,
            quote_item_id   BIGINT REFERENCES quote_items(quote_item_id) ON DELETE SET NULL,
            product_id      UUID REFERENCES productos(id) ON DELETE SET NULL,
            sku             TEXT,
            description     TEXT NOT NULL,
            quantity_ordered    NUMERIC(14,4) NOT NULL DEFAULT 0,
            quantity_packed     NUMERIC(14,4) NOT NULL DEFAULT 0,
            quantity_shipped    NUMERIC(14,4) NOT NULL DEFAULT 0,
            unit_price      NUMERIC(14,4) NOT NULL DEFAULT 0,
            discount_pct    NUMERIC(6,4)  NOT NULL DEFAULT 0,
            tax_rate        NUMERIC(6,4)  NOT NULL DEFAULT 0.16,
            subtotal        NUMERIC(14,4) NOT NULL DEFAULT 0,
            tax_amount      NUMERIC(14,4) NOT NULL DEFAULT 0,
            total           NUMERIC(14,4) NOT NULL DEFAULT 0,
            notes           TEXT,
            sort_order      SMALLINT NOT NULL DEFAULT 0,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_order_items_packed  CHECK (quantity_packed  <= quantity_ordered),
            CONSTRAINT chk_order_items_shipped CHECK (quantity_shipped <= quantity_ordered)
        )
    """)

    # ── 10. order_milestones ────��─────────────────────────────────────────────
    op.execute("""
        CREATE TABLE order_milestones (
            milestone_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            order_id        BIGINT NOT NULL
                REFERENCES orders(order_id) ON DELETE CASCADE,
            milestone_type  TEXT NOT NULL
                CHECK (milestone_type IN (
                    'CREATED','CONFIRMED','APPROVED','IN_PRODUCTION',
                    'READY_TO_SHIP','SHIPPED','DELIVERED',
                    'INVOICED','PAID','CANCELLED'
                )),
            occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            recorded_by     UUID REFERENCES users(id),
            notes           TEXT
        )
    """)

    # ── 11. cfdi ────────────────────���──────────────────────────���──────────────
    op.execute("""
        CREATE TABLE cfdi (
            cfdi_id                         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            cfdi_number                     TEXT NOT NULL UNIQUE,
            uuid                            TEXT UNIQUE,
            cfdi_type                       TEXT NOT NULL DEFAULT 'I'
                CHECK (cfdi_type IN ('I','E','P','N','T')),
            series                          TEXT,
            order_id                        BIGINT REFERENCES orders(order_id),
            customer_id                     BIGINT NOT NULL REFERENCES customers(customer_id),
            sales_rep_id                    UUID REFERENCES users(id),
            issue_date                      DATE NOT NULL DEFAULT CURRENT_DATE,
            certification_date              TIMESTAMPTZ,
            subtotal                        NUMERIC(14,4) NOT NULL DEFAULT 0,
            tax_amount                      NUMERIC(14,4) NOT NULL DEFAULT 0,
            total                           NUMERIC(14,4) NOT NULL DEFAULT 0,
            currency                        TEXT NOT NULL DEFAULT 'MXN',
            exchange_rate                   NUMERIC(10,6) NOT NULL DEFAULT 1,
            payment_method                  TEXT CHECK (payment_method IN ('PPD','PUE')),
            payment_form                    TEXT,
            cfdi_use                        TEXT REFERENCES sat_cfdi_uses(use_id),
            status                          TEXT NOT NULL DEFAULT 'DRAFT'
                CHECK (status IN ('DRAFT','ISSUED','CANCELLED','SUPERSEDED')),
            pac_response                    JSONB,
            replaces_cfdi_id                BIGINT REFERENCES cfdi(cfdi_id),
            replaced_by_cfdi_id             BIGINT REFERENCES cfdi(cfdi_id),
            sat_cancellation_motive         TEXT
                CHECK (sat_cancellation_motive IN ('01','02','03','04')),
            sat_cancellation_uuid_substitute TEXT,
            cancelled_at                    TIMESTAMPTZ,
            cancellation_reason             TEXT,
            created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── 12. cfdi_items ─────────────────────────────────────────────────────��──
    op.execute("""
        CREATE TABLE cfdi_items (
            cfdi_item_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            cfdi_id         BIGINT NOT NULL
                REFERENCES cfdi(cfdi_id) ON DELETE CASCADE,
            order_item_id   BIGINT REFERENCES order_items(order_item_id) ON DELETE SET NULL,
            product_id      UUID REFERENCES productos(id) ON DELETE SET NULL,
            quantity        NUMERIC(14,4) NOT NULL DEFAULT 1,
            unit_key        TEXT,
            product_key     TEXT,
            description     TEXT NOT NULL,
            unit_price      NUMERIC(14,4) NOT NULL DEFAULT 0,
            discount_amount NUMERIC(14,4) NOT NULL DEFAULT 0,
            tax_rate        NUMERIC(6,4)  NOT NULL DEFAULT 0.16,
            subtotal        NUMERIC(14,4) NOT NULL DEFAULT 0,
            tax_amount      NUMERIC(14,4) NOT NULL DEFAULT 0,
            total           NUMERIC(14,4) NOT NULL DEFAULT 0,
            sort_order      SMALLINT NOT NULL DEFAULT 0,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── 13. cfdi_credit_notes ─────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE cfdi_credit_notes (
            credit_note_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            cfdi_id             BIGINT NOT NULL
                REFERENCES cfdi(cfdi_id) ON DELETE CASCADE,
            original_cfdi_id    BIGINT NOT NULL REFERENCES cfdi(cfdi_id),
            reason              TEXT NOT NULL,
            amount              NUMERIC(14,4) NOT NULL DEFAULT 0,
            issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            issued_by           UUID REFERENCES users(id),
            notes               TEXT
        )
    """)

    # ── 14. cfdi_payments (complementos de pago SAT) ───────────────────���──────
    op.execute("""
        CREATE TABLE cfdi_payments (
            cfdi_payment_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            cfdi_id             BIGINT NOT NULL
                REFERENCES cfdi(cfdi_id) ON DELETE CASCADE,
            payment_date        DATE NOT NULL,
            payment_form        TEXT NOT NULL,
            currency            TEXT NOT NULL DEFAULT 'MXN',
            exchange_rate       NUMERIC(10,6) NOT NULL DEFAULT 1,
            amount              NUMERIC(14,4) NOT NULL DEFAULT 0,
            partial_number      SMALLINT NOT NULL DEFAULT 1,
            previous_balance    NUMERIC(14,4) NOT NULL DEFAULT 0,
            amount_paid         NUMERIC(14,4) NOT NULL DEFAULT 0,
            remaining_balance   NUMERIC(14,4) NOT NULL DEFAULT 0,
            bank_reference      TEXT,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── 15. payments ──────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE payments (
            payment_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            payment_number  TEXT NOT NULL UNIQUE,
            customer_id     BIGINT NOT NULL REFERENCES customers(customer_id),
            payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
            payment_form    TEXT NOT NULL,
            currency        TEXT NOT NULL DEFAULT 'MXN',
            exchange_rate   NUMERIC(10,6) NOT NULL DEFAULT 1,
            amount          NUMERIC(14,4) NOT NULL DEFAULT 0,
            bank_reference  TEXT,
            bank_account    TEXT,
            notes           TEXT,
            status          TEXT NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING','APPLIED','PARTIALLY_APPLIED','CANCELLED')),
            recorded_by     UUID REFERENCES users(id),
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── 16. payment_applications ──────────────────────────────────────────────
    op.execute("""
        CREATE TABLE payment_applications (
            application_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            payment_id      BIGINT NOT NULL
                REFERENCES payments(payment_id) ON DELETE CASCADE,
            order_id        BIGINT REFERENCES orders(order_id),
            cfdi_id         BIGINT REFERENCES cfdi(cfdi_id),
            amount_applied  NUMERIC(14,4) NOT NULL DEFAULT 0,
            applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            applied_by      UUID REFERENCES users(id),
            notes           TEXT,
            CONSTRAINT chk_payment_app_target CHECK (
                (order_id IS NOT NULL) OR (cfdi_id IS NOT NULL)
            )
        )
    """)

    # ── 17. shipments ─────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE shipments (
            shipment_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            shipment_number         TEXT NOT NULL UNIQUE,
            order_id                BIGINT NOT NULL REFERENCES orders(order_id),
            delivery_note_id        BIGINT REFERENCES delivery_notes(delivery_note_id),
            customer_address_id     BIGINT REFERENCES customer_addresses(address_id),
            carrier_id              BIGINT REFERENCES carriers(carrier_id),
            tracking_number         TEXT,
            tracking_url            TEXT,
            status                  TEXT NOT NULL DEFAULT 'PREPARING'
                CHECK (status IN (
                    'PREPARING','READY','IN_TRANSIT',
                    'DELIVERED','RETURNED','INCIDENT','CANCELLED'
                )),
            shipping_cost           NUMERIC(14,4),
            shipping_date           DATE,
            estimated_arrival       DATE,
            actual_arrival          DATE,
            received_by_name        TEXT,
            delivery_evidence_url   TEXT,
            incident_notes          TEXT,
            created_by              UUID REFERENCES users(id),
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── 18. shipment_items ───────────��─────────────────────────────���──────────
    op.execute("""
        CREATE TABLE shipment_items (
            shipment_item_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            shipment_id         BIGINT NOT NULL
                REFERENCES shipments(shipment_id) ON DELETE CASCADE,
            order_item_id       BIGINT NOT NULL
                REFERENCES order_items(order_item_id),
            quantity            NUMERIC(14,4) NOT NULL DEFAULT 0,
            notes               TEXT,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── 19. shipment_tracking_events ───────────────��───────────────────────��──
    op.execute("""
        CREATE TABLE shipment_tracking_events (
            event_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            shipment_id     BIGINT NOT NULL
                REFERENCES shipments(shipment_id) ON DELETE CASCADE,
            event_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            location        TEXT,
            status_code     TEXT NOT NULL,
            description     TEXT,
            recorded_by     UUID REFERENCES users(id),
            is_automatic    BOOLEAN NOT NULL DEFAULT FALSE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── 20. routes ───────────────���─────────────────────────────���──────────────
    op.execute("""
        CREATE TABLE routes (
            route_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            route_number        TEXT NOT NULL UNIQUE,
            route_date          DATE NOT NULL DEFAULT CURRENT_DATE,
            driver_user_id      UUID REFERENCES users(id),
            vehicle_plate       TEXT,
            vehicle_label       TEXT,
            status              TEXT NOT NULL DEFAULT 'PLANNING'
                CHECK (status IN (
                    'PLANNING','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED'
                )),
            start_time          TIMESTAMPTZ,
            end_time            TIMESTAMPTZ,
            total_distance_km   NUMERIC(8,2),
            notes               TEXT,
            created_by          UUID REFERENCES users(id),
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── 21. route_stops ───────────────���───────────────────────────────────────
    # CHECK garantiza: DELIVERY tiene shipment_id, PICKUP tiene purchase_order_id
    op.execute("""
        CREATE TABLE route_stops (
            stop_id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            route_id                BIGINT NOT NULL
                REFERENCES routes(route_id) ON DELETE CASCADE,
            stop_order              SMALLINT NOT NULL DEFAULT 1,
            stop_type               TEXT NOT NULL
                CHECK (stop_type IN ('DELIVERY','PICKUP')),
            customer_address_id     BIGINT REFERENCES customer_addresses(address_id),
            shipment_id             BIGINT REFERENCES shipments(shipment_id),
            supplier_address_id     BIGINT REFERENCES supplier_addresses(address_id),
            purchase_order_id       UUID REFERENCES pedidos_proveedor(id),
            goods_receipt_id        UUID REFERENCES entradas_mercancia(id),
            estimated_arrival       TIMESTAMPTZ,
            actual_arrival          TIMESTAMPTZ,
            actual_departure        TIMESTAMPTZ,
            status                  TEXT NOT NULL DEFAULT 'PENDING'
                CHECK (status IN (
                    'PENDING','EN_ROUTE','ARRIVED','COMPLETED','FAILED','SKIPPED'
                )),
            failure_reason          TEXT,
            notes                   TEXT,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_route_stop_type CHECK (
                (stop_type = 'DELIVERY'
                    AND shipment_id IS NOT NULL
                    AND purchase_order_id IS NULL)
                OR
                (stop_type = 'PICKUP'
                    AND purchase_order_id IS NOT NULL
                    AND shipment_id IS NULL)
            ),
            UNIQUE (route_id, stop_order)
        )
    """)

    # ── Índices de búsqueda frecuente ─────────────────────────────────────────
    op.execute("CREATE INDEX ix_delivery_notes_customer ON delivery_notes(customer_id)")
    op.execute("CREATE INDEX ix_delivery_notes_status   ON delivery_notes(status)")
    op.execute("CREATE INDEX ix_quotes_customer         ON quotes(customer_id)")
    op.execute("CREATE INDEX ix_quotes_status           ON quotes(status)")
    op.execute("CREATE INDEX ix_orders_customer         ON orders(customer_id)")
    op.execute("CREATE INDEX ix_orders_status           ON orders(status)")
    op.execute("CREATE INDEX ix_orders_packing_status   ON orders(packing_status)")
    op.execute("CREATE INDEX ix_order_items_order       ON order_items(order_id)")
    op.execute("CREATE INDEX ix_order_items_product     ON order_items(product_id)")
    op.execute("CREATE INDEX ix_shipments_order         ON shipments(order_id)")
    op.execute("CREATE INDEX ix_shipments_status        ON shipments(status)")
    op.execute("CREATE INDEX ix_cfdi_order              ON cfdi(order_id)")
    op.execute("CREATE INDEX ix_cfdi_customer           ON cfdi(customer_id)")
    op.execute("CREATE INDEX ix_cfdi_status             ON cfdi(status)")
    op.execute("CREATE INDEX ix_payments_customer       ON payments(customer_id)")
    op.execute("CREATE INDEX ix_routes_date             ON routes(route_date)")
    op.execute("CREATE INDEX ix_routes_driver           ON routes(driver_user_id)")
    op.execute("CREATE INDEX ix_route_stops_route       ON route_stops(route_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_route_stops_route")
    op.execute("DROP INDEX IF EXISTS ix_routes_driver")
    op.execute("DROP INDEX IF EXISTS ix_routes_date")
    op.execute("DROP INDEX IF EXISTS ix_payments_customer")
    op.execute("DROP INDEX IF EXISTS ix_cfdi_status")
    op.execute("DROP INDEX IF EXISTS ix_cfdi_customer")
    op.execute("DROP INDEX IF EXISTS ix_cfdi_order")
    op.execute("DROP INDEX IF EXISTS ix_shipments_status")
    op.execute("DROP INDEX IF EXISTS ix_shipments_order")
    op.execute("DROP INDEX IF EXISTS ix_order_items_product")
    op.execute("DROP INDEX IF EXISTS ix_order_items_order")
    op.execute("DROP INDEX IF EXISTS ix_orders_packing_status")
    op.execute("DROP INDEX IF EXISTS ix_orders_status")
    op.execute("DROP INDEX IF EXISTS ix_orders_customer")
    op.execute("DROP INDEX IF EXISTS ix_quotes_status")
    op.execute("DROP INDEX IF EXISTS ix_quotes_customer")
    op.execute("DROP INDEX IF EXISTS ix_delivery_notes_status")
    op.execute("DROP INDEX IF EXISTS ix_delivery_notes_customer")

    # Tablas en orden inverso de dependencias
    op.execute("DROP TABLE IF EXISTS route_stops")
    op.execute("DROP TABLE IF EXISTS routes")
    op.execute("DROP TABLE IF EXISTS shipment_tracking_events")
    op.execute("DROP TABLE IF EXISTS shipment_items")
    op.execute("DROP TABLE IF EXISTS shipments")
    op.execute("DROP TABLE IF EXISTS payment_applications")
    op.execute("DROP TABLE IF EXISTS payments")
    op.execute("DROP TABLE IF EXISTS cfdi_payments")
    op.execute("DROP TABLE IF EXISTS cfdi_credit_notes")
    op.execute("DROP TABLE IF EXISTS cfdi_items")
    op.execute("DROP TABLE IF EXISTS cfdi")
    op.execute("DROP TABLE IF EXISTS order_milestones")
    op.execute("DROP TABLE IF EXISTS order_items")
    op.execute("DROP TABLE IF EXISTS orders")
    op.execute("DROP TABLE IF EXISTS quote_delivery_notes")
    op.execute("DROP TABLE IF EXISTS quote_status_history")
    op.execute("DROP TABLE IF EXISTS quote_items")
    op.execute("DROP TABLE IF EXISTS quotes")
    op.execute("DROP TABLE IF EXISTS delivery_note_items")
    op.execute("DROP TABLE IF EXISTS delivery_notes")
    op.execute("DROP TABLE IF EXISTS carriers")

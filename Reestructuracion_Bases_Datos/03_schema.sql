-- =====================================================================
-- RTB - Esquema PostgreSQL 14+
-- Sistema de gestión de venta B2B de maquinaria industrial y partes
-- Reemplaza el sistema actual basado en Notion + n8n
-- =====================================================================

-- Extensiones útiles
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;       -- email/RFC case-insensitive
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- exclusion constraints en rangos

-- Esquemas para organizar
CREATE SCHEMA IF NOT EXISTS rtb;
SET search_path = rtb, public;


-- =====================================================================
-- 1. SEGURIDAD Y AUDITORÍA
-- =====================================================================

CREATE TABLE users (
    user_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email           CITEXT NOT NULL UNIQUE,
    full_name       TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE users IS 'Usuarios del sistema (operadores internos)';

CREATE TABLE roles (
    role_id         SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    description     TEXT
);

CREATE TABLE permissions (
    permission_id   SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,
    description     TEXT
);

CREATE TABLE user_roles (
    user_id         BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_id         SMALLINT NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
    role_id         SMALLINT NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id   SMALLINT NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE audit_log (
    audit_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT REFERENCES users(user_id),
    entity_type     TEXT NOT NULL,
    entity_id       BIGINT NOT NULL,
    action          TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
    before_data     JSONB,
    after_data      JSONB,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_changed_at ON audit_log (changed_at DESC);


-- =====================================================================
-- 2. CATÁLOGOS SAT (CFDI 4.0)
-- =====================================================================

CREATE TABLE sat_product_keys (
    key_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sat_code        TEXT NOT NULL UNIQUE,
    description     TEXT NOT NULL
);

CREATE TABLE sat_unit_keys (
    unit_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sat_code        TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    symbol          TEXT
);

CREATE TABLE sat_tax_regimes (
    regime_id       SMALLINT PRIMARY KEY,
    description     TEXT NOT NULL
);

CREATE TABLE sat_cfdi_uses (
    use_id          TEXT PRIMARY KEY,
    description     TEXT NOT NULL
);

CREATE TABLE sat_payment_methods (
    method_id       TEXT PRIMARY KEY,
    description     TEXT NOT NULL
);

CREATE TABLE sat_payment_forms (
    form_id         TEXT PRIMARY KEY,
    description     TEXT NOT NULL
);


-- =====================================================================
-- 3. CATÁLOGOS DE NEGOCIO: marcas y categorías
-- =====================================================================

CREATE TABLE brands (
    brand_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE categories (
    category_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parent_id          BIGINT REFERENCES categories(category_id),
    name               TEXT NOT NULL,
    slug               TEXT NOT NULL UNIQUE,
    profit_margin_pct  NUMERIC(5,2) NOT NULL DEFAULT 35
        CHECK (profit_margin_pct >= 0 AND profit_margin_pct <= 1000),
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (parent_id, name)
);
COMMENT ON COLUMN categories.profit_margin_pct IS
  'Markup sobre costo. precio_venta = costo × (1 + profit_margin_pct/100). Único nivel de margen del sistema.';


-- =====================================================================
-- 4. PRODUCTOS Y CONFIGURABILIDAD
-- =====================================================================

CREATE TABLE products (
    product_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku                 TEXT NOT NULL UNIQUE,
    internal_code       TEXT UNIQUE,
    name                TEXT NOT NULL,
    description         TEXT,
    brand_id            BIGINT REFERENCES brands(brand_id),
    category_id         BIGINT NOT NULL REFERENCES categories(category_id),
    sat_product_key_id  BIGINT REFERENCES sat_product_keys(key_id),
    sat_unit_id         BIGINT REFERENCES sat_unit_keys(unit_id),
    is_configurable     BOOLEAN NOT NULL DEFAULT FALSE,
    is_assembled        BOOLEAN NOT NULL DEFAULT FALSE,
    package_size        NUMERIC(12,4),
    min_stock           NUMERIC(14,4) NOT NULL DEFAULT 0,
    -- Pricing
    pricing_strategy    TEXT NOT NULL DEFAULT 'MOVING_AVG'
        CHECK (pricing_strategy IN ('MOVING_AVG','PASSTHROUGH')),
    moving_avg_months   SMALLINT NOT NULL DEFAULT 6
        CHECK (moving_avg_months BETWEEN 1 AND 60),
    current_avg_cost            NUMERIC(14,4),
    current_avg_cost_currency   CHAR(3) NOT NULL DEFAULT 'MXN',
    current_avg_cost_updated_at TIMESTAMPTZ,
    -- Estado
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN products.pricing_strategy IS
  'MOVING_AVG = costo×(1+margen). PASSTHROUGH = precio = costo (sin margen).';
COMMENT ON COLUMN products.moving_avg_months IS
  'Ventana del promedio móvil. Default 6 meses.';
CREATE INDEX idx_products_sku ON products (sku);
CREATE INDEX idx_products_internal ON products (internal_code);
CREATE INDEX idx_products_category ON products (category_id);

CREATE TABLE product_attributes (
    attribute_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id      BIGINT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    data_type       TEXT NOT NULL CHECK (data_type IN ('TEXT','NUMBER','BOOLEAN','OPTION')),
    is_required     BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    UNIQUE (product_id, name)
);

CREATE TABLE product_attribute_options (
    option_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    attribute_id    BIGINT NOT NULL REFERENCES product_attributes(attribute_id) ON DELETE CASCADE,
    value           TEXT NOT NULL,
    extra_cost      NUMERIC(14,4) NOT NULL DEFAULT 0,
    UNIQUE (attribute_id, value)
);

CREATE TABLE product_configurations (
    configuration_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id          BIGINT NOT NULL REFERENCES products(product_id),
    config_sku          TEXT UNIQUE,
    config_hash         TEXT NOT NULL,
    attributes          JSONB NOT NULL,
    additional_cost     NUMERIC(14,4) NOT NULL DEFAULT 0,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, config_hash)
);
CREATE INDEX idx_product_configs_product ON product_configurations (product_id);

CREATE TABLE bom (
    bom_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id      BIGINT NOT NULL REFERENCES products(product_id),
    version         SMALLINT NOT NULL DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, version)
);

CREATE TABLE bom_items (
    bom_item_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bom_id          BIGINT NOT NULL REFERENCES bom(bom_id) ON DELETE CASCADE,
    component_id    BIGINT NOT NULL REFERENCES products(product_id),
    quantity        NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
    notes           TEXT
);
CREATE INDEX idx_bom_items_bom ON bom_items (bom_id);

-- Histórico de costo promedio (no necesita más FKs)
CREATE TABLE product_cost_history (
    history_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id           BIGINT NOT NULL REFERENCES products(product_id),
    previous_avg_cost    NUMERIC(14,4),
    new_avg_cost         NUMERIC(14,4) NOT NULL,
    quantity_received    NUMERIC(14,4),
    unit_cost_of_receipt NUMERIC(14,4),
    triggered_by         TEXT NOT NULL CHECK (triggered_by IN
        ('GOODS_RECEIPT','OPENING_BALANCE','MANUAL_RECALC','NIGHTLY_REFRESH')),
    source_id            BIGINT,
    recorded_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cost_history_product ON product_cost_history (product_id, recorded_at DESC);


-- =====================================================================
-- 5. CLIENTES
-- =====================================================================

CREATE TABLE customers (
    customer_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code               TEXT NOT NULL UNIQUE,
    business_name      TEXT NOT NULL,
    customer_type      TEXT NOT NULL DEFAULT 'COMPANY' CHECK (customer_type IN ('COMPANY','PERSON')),
    locality           TEXT NOT NULL DEFAULT 'LOCAL'   CHECK (locality IN ('LOCAL','FOREIGN')),
    payment_terms_days SMALLINT NOT NULL DEFAULT 0,
    credit_limit       NUMERIC(14,2),
    currency           CHAR(3) NOT NULL DEFAULT 'MXN',
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN customers.locality IS 'LOCAL (mismo estado/zona) o FOREIGN (foráneo).';

CREATE TABLE customer_tax_data (
    tax_data_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    rfc             CITEXT NOT NULL,
    legal_name      TEXT NOT NULL,
    tax_regime_id   SMALLINT REFERENCES sat_tax_regimes(regime_id),
    cfdi_use_id     TEXT REFERENCES sat_cfdi_uses(use_id),
    zip_code        TEXT NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_id, rfc)
);

CREATE TABLE customer_addresses (
    address_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    address_type    TEXT NOT NULL CHECK (address_type IN ('FISCAL','DELIVERY','OTHER')),
    tax_data_id     BIGINT REFERENCES customer_tax_data(tax_data_id),
    label           TEXT,
    street          TEXT NOT NULL,
    exterior_number TEXT,
    interior_number TEXT,
    neighborhood    TEXT,
    city            TEXT,
    state           TEXT,
    country         TEXT NOT NULL DEFAULT 'México',
    zip_code        TEXT,
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK (
        (address_type = 'FISCAL' AND tax_data_id IS NOT NULL)
        OR (address_type <> 'FISCAL' AND tax_data_id IS NULL)
    )
);
CREATE INDEX idx_customer_addresses_customer ON customer_addresses (customer_id);
CREATE INDEX idx_customer_addresses_tax_data ON customer_addresses (tax_data_id) WHERE tax_data_id IS NOT NULL;
COMMENT ON COLUMN customer_addresses.address_type IS
  'FISCAL = domicilio fiscal del RFC (ligado a tax_data_id). DELIVERY = local/sucursal donde se entrega. OTHER = uso libre.';

CREATE TABLE customer_contacts (
    contact_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    role_title      TEXT,
    email           CITEXT,
    phone           TEXT,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE
);


-- =====================================================================
-- 6. PROVEEDORES
-- =====================================================================

CREATE TABLE suppliers (
    supplier_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,
    business_name   TEXT NOT NULL,
    supplier_type   TEXT NOT NULL DEFAULT 'GOODS' CHECK (supplier_type IN ('GOODS','SERVICES','BOTH')),
    locality        TEXT NOT NULL DEFAULT 'LOCAL'  CHECK (locality IN ('LOCAL','FOREIGN')),
    is_occasional   BOOLEAN NOT NULL DEFAULT FALSE,
    payment_terms_days SMALLINT NOT NULL DEFAULT 0,
    avg_payment_time_days SMALLINT,
    currency        CHAR(3) NOT NULL DEFAULT 'MXN',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN suppliers.locality IS 'LOCAL o FOREIGN. Afecta logística y retenciones.';
COMMENT ON COLUMN suppliers.is_occasional IS 'TRUE = compra única, ficha mínima.';

CREATE TABLE supplier_tax_data (
    tax_data_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_id     BIGINT NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
    rfc             CITEXT NOT NULL,
    legal_name      TEXT NOT NULL,
    tax_regime_id   SMALLINT REFERENCES sat_tax_regimes(regime_id),
    zip_code        TEXT,
    is_default      BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (supplier_id, rfc)
);

CREATE TABLE supplier_addresses (
    address_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_id     BIGINT NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
    address_type    TEXT NOT NULL DEFAULT 'FISCAL' CHECK (address_type IN ('FISCAL','PICKUP','OTHER')),
    tax_data_id     BIGINT REFERENCES supplier_tax_data(tax_data_id),
    label           TEXT,
    street          TEXT NOT NULL,
    exterior_number TEXT,
    interior_number TEXT,
    neighborhood    TEXT,
    city            TEXT,
    state           TEXT,
    country         TEXT NOT NULL DEFAULT 'México',
    zip_code        TEXT,
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK (
        (address_type = 'FISCAL' AND tax_data_id IS NOT NULL)
        OR (address_type <> 'FISCAL' AND tax_data_id IS NULL)
    )
);
CREATE INDEX idx_supplier_addresses_supplier ON supplier_addresses (supplier_id);

CREATE TABLE supplier_contacts (
    contact_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_id     BIGINT NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    role_title      TEXT,
    email           CITEXT,
    phone           TEXT,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE supplier_products (
    supplier_product_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_id     BIGINT NOT NULL REFERENCES suppliers(supplier_id),
    product_id      BIGINT NOT NULL REFERENCES products(product_id),
    supplier_sku    TEXT,
    unit_cost       NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
    currency        CHAR(3) NOT NULL DEFAULT 'MXN',
    lead_time_days  SMALLINT,
    moq             NUMERIC(14,4),
    is_available    BOOLEAN NOT NULL DEFAULT TRUE,
    is_preferred    BOOLEAN NOT NULL DEFAULT FALSE,
    valid_from      DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to        DATE,
    is_current      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_supplier_products_product ON supplier_products (product_id) WHERE is_current;
CREATE INDEX idx_supplier_products_supplier ON supplier_products (supplier_id) WHERE is_current;


-- =====================================================================
-- 7. PRICING: convenios cliente×producto (Ariba)
-- =====================================================================

CREATE TABLE customer_contract_prices (
    contract_price_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id         BIGINT NOT NULL REFERENCES customers(customer_id),
    product_id          BIGINT NOT NULL REFERENCES products(product_id),
    contract_type       TEXT NOT NULL DEFAULT 'ARIBA'
        CHECK (contract_type IN ('ARIBA','CONTRACT_OTHER')),
    fixed_sale_price    NUMERIC(14,4) NOT NULL CHECK (fixed_sale_price >= 0),
    currency            CHAR(3) NOT NULL DEFAULT 'MXN',
    valid_from          DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to            DATE,
    is_current          BOOLEAN NOT NULL DEFAULT TRUE,
    last_change_notice  TEXT,
    last_changed_by     BIGINT REFERENCES users(user_id),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contract_prices_lookup
  ON customer_contract_prices (customer_id, product_id) WHERE is_current;
COMMENT ON TABLE customer_contract_prices IS
  'Precios fijos acordados con clientes específicos (típicamente convenios Ariba).';


-- =====================================================================
-- 8. VENTAS: COTIZACIONES Y PEDIDOS
-- =====================================================================

CREATE TABLE quotes (
    quote_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    quote_number        TEXT NOT NULL UNIQUE,
    customer_id         BIGINT NOT NULL REFERENCES customers(customer_id),
    customer_address_id BIGINT REFERENCES customer_addresses(address_id),
    sales_rep_id        BIGINT REFERENCES users(user_id),
    status              TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','SENT','APPROVED','REJECTED','CANCELLED','EXPIRED')),
    issue_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date     DATE,
    approval_date       DATE,
    follow_up_date      DATE,
    payment_type        TEXT,
    payment_terms_days  SMALLINT,
    delivery_type       TEXT,
    requires_credit     BOOLEAN NOT NULL DEFAULT FALSE,
    credit_months       SMALLINT,
    currency            CHAR(3) NOT NULL DEFAULT 'MXN',
    exchange_rate       NUMERIC(14,6) NOT NULL DEFAULT 1,
    discount_amount     NUMERIC(14,4) NOT NULL DEFAULT 0,
    shipping_amount     NUMERIC(14,4) NOT NULL DEFAULT 0,
    subtotal            NUMERIC(14,4) NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(14,4) NOT NULL DEFAULT 0,
    total               NUMERIC(14,4) NOT NULL DEFAULT 0,
    cost_subtotal       NUMERIC(14,4) NOT NULL DEFAULT 0,
    cancellation_reason TEXT,
    cancelled_at        TIMESTAMPTZ,
    cancelled_by        BIGINT REFERENCES users(user_id),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (status = 'CANCELLED' AND cancellation_reason IS NOT NULL AND cancelled_at IS NOT NULL)
        OR status <> 'CANCELLED'
    )
);
CREATE INDEX idx_quotes_customer ON quotes (customer_id);
CREATE INDEX idx_quotes_status ON quotes (status);
CREATE INDEX idx_quotes_issue_date ON quotes (issue_date DESC);

-- quote_items con FKs que ya existen. cost_source_po_id se agrega con ALTER al final.
CREATE TABLE quote_items (
    quote_item_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    quote_id                BIGINT NOT NULL REFERENCES quotes(quote_id) ON DELETE CASCADE,
    line_number             SMALLINT NOT NULL,
    product_id              BIGINT NOT NULL REFERENCES products(product_id),
    product_configuration_id BIGINT REFERENCES product_configurations(configuration_id),
    description_override    TEXT,
    quantity_requested      NUMERIC(14,4) NOT NULL CHECK (quantity_requested > 0),
    quantity_packed         NUMERIC(14,4) NOT NULL DEFAULT 0,
    unit_price_sale         NUMERIC(14,4) NOT NULL CHECK (unit_price_sale >= 0),
    unit_cost_purchase      NUMERIC(14,4) NOT NULL DEFAULT 0,
    discount_pct            NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
    tax_pct                 NUMERIC(5,2) NOT NULL DEFAULT 16,
    cost_basis              TEXT NOT NULL DEFAULT 'MOVING_AVG'
        CHECK (cost_basis IN ('MOVING_AVG','PASSTHROUGH','CONTRACT_FIXED','SUPPLIER_SPECIFIC','MANUAL_OVERRIDE')),
    cost_override_reason    TEXT,
    cost_source_supplier_id BIGINT REFERENCES suppliers(supplier_id),
    cost_source_po_id       BIGINT,    -- FK agregada al final (depende de purchase_orders)
    contract_price_id       BIGINT REFERENCES customer_contract_prices(contract_price_id),
    subtotal                NUMERIC(14,4) NOT NULL DEFAULT 0,
    tax_amount              NUMERIC(14,4) NOT NULL DEFAULT 0,
    total                   NUMERIC(14,4) NOT NULL DEFAULT 0,
    cost_subtotal           NUMERIC(14,4) NOT NULL DEFAULT 0,
    notes                   TEXT,
    UNIQUE (quote_id, line_number),
    CHECK (quantity_packed <= quantity_requested),
    CHECK (
        cost_basis NOT IN ('SUPPLIER_SPECIFIC','MANUAL_OVERRIDE')
        OR (cost_override_reason IS NOT NULL AND length(cost_override_reason) >= 10)
    ),
    CHECK (cost_basis <> 'CONTRACT_FIXED' OR contract_price_id IS NOT NULL)
);
CREATE INDEX idx_quote_items_quote ON quote_items (quote_id);
CREATE INDEX idx_quote_items_product ON quote_items (product_id);

CREATE TABLE quote_status_history (
    history_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    quote_id        BIGINT NOT NULL REFERENCES quotes(quote_id) ON DELETE CASCADE,
    old_status      TEXT,
    new_status      TEXT NOT NULL,
    changed_by      BIGINT REFERENCES users(user_id),
    reason          TEXT,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quote_history_quote ON quote_status_history (quote_id);

CREATE TABLE orders (
    order_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_number        TEXT NOT NULL UNIQUE,
    quote_id            BIGINT NOT NULL UNIQUE REFERENCES quotes(quote_id),
    customer_id         BIGINT NOT NULL REFERENCES customers(customer_id),
    shipping_address_id BIGINT REFERENCES customer_addresses(address_id),
    status              TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','PARTIALLY_PACKED','READY_TO_SHIP','SHIPPED','DELIVERED','INVOICED','PAID','CANCELLED')),
    payment_status      TEXT NOT NULL DEFAULT 'UNPAID'
        CHECK (payment_status IN ('UNPAID','PARTIAL','PAID','OVERDUE','REFUNDED')),
    invoice_status      TEXT NOT NULL DEFAULT 'NOT_INVOICED'
        CHECK (invoice_status IN ('NOT_INVOICED','PARTIAL','INVOICED')),
    has_shortage        BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_type       TEXT,
    payment_type        TEXT,
    fulfillment_user_id BIGINT REFERENCES users(user_id),
    order_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    validation_date     DATE,
    approval_date       DATE,
    association_date    DATE,
    shipping_date       DATE,
    delivery_date       DATE,
    invoicing_date      DATE,
    payment_date        DATE,
    delivery_lead_days  INTEGER,
    payment_lead_days   INTEGER,
    preparation_lead_days INTEGER,
    subtotal            NUMERIC(14,4) NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(14,4) NOT NULL DEFAULT 0,
    shipping_amount     NUMERIC(14,4) NOT NULL DEFAULT 0,
    total               NUMERIC(14,4) NOT NULL DEFAULT 0,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_customer ON orders (customer_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_has_shortage ON orders (has_shortage) WHERE has_shortage;

CREATE TABLE order_items (
    order_item_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id            BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    quote_item_id       BIGINT REFERENCES quote_items(quote_item_id),
    line_number         SMALLINT NOT NULL,
    product_id          BIGINT NOT NULL REFERENCES products(product_id),
    product_configuration_id BIGINT REFERENCES product_configurations(configuration_id),
    quantity_ordered    NUMERIC(14,4) NOT NULL CHECK (quantity_ordered > 0),
    quantity_packed     NUMERIC(14,4) NOT NULL DEFAULT 0,
    quantity_shipped    NUMERIC(14,4) NOT NULL DEFAULT 0,
    quantity_invoiced   NUMERIC(14,4) NOT NULL DEFAULT 0,
    unit_price_sale     NUMERIC(14,4) NOT NULL,
    discount_pct        NUMERIC(5,2) NOT NULL DEFAULT 0,
    tax_pct             NUMERIC(5,2) NOT NULL DEFAULT 16,
    subtotal            NUMERIC(14,4) NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(14,4) NOT NULL DEFAULT 0,
    total               NUMERIC(14,4) NOT NULL DEFAULT 0,
    UNIQUE (order_id, line_number),
    CHECK (quantity_packed <= quantity_ordered),
    CHECK (quantity_shipped <= quantity_packed),
    CHECK (quantity_invoiced <= quantity_shipped)
);
CREATE INDEX idx_order_items_order ON order_items (order_id);

CREATE TABLE order_milestones (
    milestone_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id        BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    milestone_type  TEXT NOT NULL CHECK (milestone_type IN
        ('CREATED','VALIDATED','APPROVED','ASSOCIATED','PACKED','SHIPPED','DELIVERED','INVOICED','PAID','CANCELLED','OTHER')),
    milestone_date  DATE NOT NULL,
    user_id         BIGINT REFERENCES users(user_id),
    notes           TEXT,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_milestones_order ON order_milestones (order_id);


-- =====================================================================
-- 9. COMPRAS
-- =====================================================================

CREATE TABLE purchase_requests (
    request_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_number      TEXT NOT NULL UNIQUE,
    requested_by        BIGINT REFERENCES users(user_id),
    request_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    status              TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','APPROVED','PARTIALLY_ORDERED','ORDERED','REJECTED','CANCELLED')),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE purchase_request_items (
    request_item_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id          BIGINT NOT NULL REFERENCES purchase_requests(request_id) ON DELETE CASCADE,
    line_number         SMALLINT NOT NULL,
    product_id          BIGINT NOT NULL REFERENCES products(product_id),
    quantity_requested  NUMERIC(14,4) NOT NULL CHECK (quantity_requested > 0),
    quantity_after_conversion NUMERIC(14,4),
    quantity_ordered    NUMERIC(14,4) NOT NULL DEFAULT 0,
    suggested_supplier_id BIGINT REFERENCES suppliers(supplier_id),
    quote_item_id       BIGINT REFERENCES quote_items(quote_item_id),
    in_package          BOOLEAN NOT NULL DEFAULT FALSE,
    exception_reason    TEXT,
    UNIQUE (request_id, line_number)
);
CREATE INDEX idx_pri_request ON purchase_request_items (request_id);
CREATE INDEX idx_pri_product ON purchase_request_items (product_id);

CREATE TABLE purchase_orders (
    po_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    po_number           TEXT NOT NULL UNIQUE,
    supplier_id         BIGINT NOT NULL REFERENCES suppliers(supplier_id),
    status              TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','SENT','CONFIRMED','PARTIAL_RECEIVED','RECEIVED','INVOICED','PAID','CANCELLED')),
    collection_status   TEXT,
    issue_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    sent_date           DATE,
    confirmation_date   DATE,
    estimated_pickup_date DATE,
    pickup_date         DATE,
    is_confirmed        BOOLEAN NOT NULL DEFAULT FALSE,
    is_email_sent       BOOLEAN NOT NULL DEFAULT FALSE,
    is_printed          BOOLEAN NOT NULL DEFAULT FALSE,
    follow_up_user_id   BIGINT REFERENCES users(user_id),
    currency            CHAR(3) NOT NULL DEFAULT 'MXN',
    exchange_rate       NUMERIC(14,6) NOT NULL DEFAULT 1,
    subtotal            NUMERIC(14,4) NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(14,4) NOT NULL DEFAULT 0,
    shipping_amount     NUMERIC(14,4) NOT NULL DEFAULT 0,
    total               NUMERIC(14,4) NOT NULL DEFAULT 0,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_po_supplier ON purchase_orders (supplier_id);
CREATE INDEX idx_po_status ON purchase_orders (status);

CREATE TABLE purchase_order_items (
    po_item_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    po_id               BIGINT NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    line_number         SMALLINT NOT NULL,
    product_id          BIGINT NOT NULL REFERENCES products(product_id),
    request_item_id     BIGINT REFERENCES purchase_request_items(request_item_id),
    quantity_ordered    NUMERIC(14,4) NOT NULL CHECK (quantity_ordered > 0),
    quantity_received   NUMERIC(14,4) NOT NULL DEFAULT 0,
    unit_cost           NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
    tax_pct             NUMERIC(5,2) NOT NULL DEFAULT 16,
    subtotal            NUMERIC(14,4) NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(14,4) NOT NULL DEFAULT 0,
    total               NUMERIC(14,4) NOT NULL DEFAULT 0,
    UNIQUE (po_id, line_number),
    CHECK (quantity_received <= quantity_ordered)
);
CREATE INDEX idx_poi_po ON purchase_order_items (po_id);

CREATE TABLE supplier_invoices (
    invoice_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_id         BIGINT NOT NULL REFERENCES suppliers(supplier_id),
    invoice_number      TEXT NOT NULL,
    supplier_quote_number TEXT,
    uuid_sat            TEXT,
    invoice_date        DATE NOT NULL,
    receipt_date        DATE,
    payment_due_date    DATE,
    payment_date        DATE,
    purchase_type       TEXT,
    payment_type        TEXT,
    payment_status      TEXT NOT NULL DEFAULT 'UNPAID'
        CHECK (payment_status IN ('UNPAID','PARTIAL','PAID')),
    status              TEXT NOT NULL DEFAULT 'RECEIVED'
        CHECK (status IN ('RECEIVED','VALIDATED','PAID','CANCELLED')),
    currency            CHAR(3) NOT NULL DEFAULT 'MXN',
    subtotal            NUMERIC(14,4) NOT NULL DEFAULT 0,
    discount_amount     NUMERIC(14,4) NOT NULL DEFAULT 0,
    shipping_amount     NUMERIC(14,4) NOT NULL DEFAULT 0,
    insurance_amount    NUMERIC(14,4) NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(14,4) NOT NULL DEFAULT 0,
    total               NUMERIC(14,4) NOT NULL DEFAULT 0,
    review_user_id      BIGINT REFERENCES users(user_id),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (supplier_id, invoice_number)
);

CREATE TABLE supplier_invoice_items (
    invoice_item_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_id          BIGINT NOT NULL REFERENCES supplier_invoices(invoice_id) ON DELETE CASCADE,
    po_item_id          BIGINT REFERENCES purchase_order_items(po_item_id),
    line_number         SMALLINT NOT NULL,
    product_id          BIGINT NOT NULL REFERENCES products(product_id),
    quantity            NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
    unit_cost           NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
    tax_pct             NUMERIC(5,2) NOT NULL DEFAULT 16,
    subtotal            NUMERIC(14,4) NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(14,4) NOT NULL DEFAULT 0,
    total               NUMERIC(14,4) NOT NULL DEFAULT 0,
    UNIQUE (invoice_id, line_number)
);
CREATE INDEX idx_sii_invoice ON supplier_invoice_items (invoice_id);

CREATE TABLE goods_receipts (
    receipt_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    receipt_number      TEXT NOT NULL UNIQUE,
    po_id               BIGINT REFERENCES purchase_orders(po_id),
    supplier_invoice_id BIGINT REFERENCES supplier_invoices(invoice_id),
    supplier_id         BIGINT NOT NULL REFERENCES suppliers(supplier_id),
    receipt_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    physical_validation BOOLEAN NOT NULL DEFAULT FALSE,
    validated_by        BIGINT REFERENCES users(user_id),
    validated_at        TIMESTAMPTZ,
    delivery_pct        NUMERIC(5,2) NOT NULL DEFAULT 0,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gr_supplier ON goods_receipts (supplier_id);
CREATE INDEX idx_gr_po ON goods_receipts (po_id);

CREATE TABLE goods_receipt_items (
    receipt_item_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    receipt_id          BIGINT NOT NULL REFERENCES goods_receipts(receipt_id) ON DELETE CASCADE,
    po_item_id          BIGINT REFERENCES purchase_order_items(po_item_id),
    invoice_item_id     BIGINT REFERENCES supplier_invoice_items(invoice_item_id),
    line_number         SMALLINT NOT NULL,
    product_id          BIGINT NOT NULL REFERENCES products(product_id),
    quantity_requested  NUMERIC(14,4) NOT NULL,
    quantity_received   NUMERIC(14,4) NOT NULL CHECK (quantity_received >= 0),
    quantity_after_conversion NUMERIC(14,4),
    unit_cost           NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
    notes               TEXT,
    UNIQUE (receipt_id, line_number)
);


-- =====================================================================
-- 10. INVENTARIO
-- =====================================================================

CREATE TABLE inventory_movements (
    movement_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id          BIGINT NOT NULL REFERENCES products(product_id),
    movement_type       TEXT NOT NULL CHECK (movement_type IN
        ('RECEIPT','ISSUE','ADJUSTMENT_IN','ADJUSTMENT_OUT','RETURN_IN','RETURN_OUT','TRANSFER_IN','TRANSFER_OUT','OPENING_BALANCE')),
    source_type         TEXT CHECK (source_type IN
        ('GOODS_RECEIPT','ORDER_ITEM','NON_CONFORMITY','MANUAL_ADJUSTMENT','OPENING','RETURN','ASSET_INSTALL','ASSET_REMOVE')),
    source_id           BIGINT,
    quantity_in         NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (quantity_in >= 0),
    quantity_out        NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (quantity_out >= 0),
    unit_cost           NUMERIC(14,4),
    user_id             BIGINT REFERENCES users(user_id),
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes               TEXT,
    CHECK ((quantity_in > 0 AND quantity_out = 0) OR (quantity_out > 0 AND quantity_in = 0)),
    CHECK (
        (movement_type IN ('RECEIPT','ADJUSTMENT_IN','RETURN_IN','TRANSFER_IN','OPENING_BALANCE') AND quantity_in > 0)
        OR (movement_type IN ('ISSUE','ADJUSTMENT_OUT','RETURN_OUT','TRANSFER_OUT') AND quantity_out > 0)
    )
);
CREATE INDEX idx_inv_mov_product ON inventory_movements (product_id);
CREATE INDEX idx_inv_mov_occurred ON inventory_movements (occurred_at DESC);
CREATE INDEX idx_inv_mov_source ON inventory_movements (source_type, source_id);

CREATE TABLE non_conformities (
    nc_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    folio               TEXT NOT NULL UNIQUE,
    product_id          BIGINT NOT NULL REFERENCES products(product_id),
    supplier_invoice_id BIGINT REFERENCES supplier_invoices(invoice_id),
    order_id            BIGINT REFERENCES orders(order_id),
    detected_by         BIGINT REFERENCES users(user_id),
    nc_date             DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity            NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
    reason              TEXT NOT NULL,
    action_taken        TEXT,
    adjustment_type     TEXT NOT NULL CHECK (adjustment_type IN ('IN','OUT')),
    status              TEXT NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN','RESOLVED','CANCELLED')),
    temporary_location  TEXT,
    inventory_movement_id BIGINT REFERENCES inventory_movements(movement_id),
    observations        TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inventory_snapshots (
    snapshot_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id          BIGINT NOT NULL REFERENCES products(product_id),
    snapshot_date       DATE NOT NULL,
    quantity_on_hand    NUMERIC(14,4) NOT NULL,
    avg_unit_cost       NUMERIC(14,4),
    total_value         NUMERIC(14,4),
    days_without_movement INTEGER,
    abc_classification  CHAR(1),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, snapshot_date)
);
CREATE INDEX idx_snapshots_date ON inventory_snapshots (snapshot_date DESC);


-- =====================================================================
-- 11. FACTURACIÓN A CLIENTES (CFDI 4.0 SAT MÉXICO)
-- =====================================================================

CREATE TABLE cfdi (
    cfdi_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cfdi_type           CHAR(1) NOT NULL CHECK (cfdi_type IN ('I','E','N','P','T')),
    series              TEXT,
    folio               TEXT,
    uuid                TEXT UNIQUE,
    customer_id         BIGINT NOT NULL REFERENCES customers(customer_id),
    customer_tax_data_id BIGINT NOT NULL REFERENCES customer_tax_data(tax_data_id),
    order_id            BIGINT REFERENCES orders(order_id),
    issuer_rfc          CITEXT NOT NULL,
    issuer_legal_name   TEXT NOT NULL,
    issuer_tax_regime_id SMALLINT NOT NULL REFERENCES sat_tax_regimes(regime_id),
    issuer_zip_code     TEXT NOT NULL,
    receiver_rfc        CITEXT NOT NULL,
    receiver_legal_name TEXT NOT NULL,
    receiver_tax_regime_id SMALLINT NOT NULL REFERENCES sat_tax_regimes(regime_id),
    receiver_zip_code   TEXT NOT NULL,
    cfdi_use_id         TEXT NOT NULL REFERENCES sat_cfdi_uses(use_id),
    payment_method_id   TEXT NOT NULL REFERENCES sat_payment_methods(method_id),
    payment_form_id     TEXT REFERENCES sat_payment_forms(form_id),
    currency            CHAR(3) NOT NULL DEFAULT 'MXN',
    exchange_rate       NUMERIC(14,6) NOT NULL DEFAULT 1,
    issue_date          TIMESTAMPTZ NOT NULL DEFAULT now(),
    place_of_issue_zip  TEXT NOT NULL,
    subtotal            NUMERIC(14,4) NOT NULL,
    discount            NUMERIC(14,4) NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(14,4) NOT NULL,
    total               NUMERIC(14,4) NOT NULL,
    pac_provider        TEXT,
    sello_cfdi          TEXT,
    sello_sat           TEXT,
    certificate_number  TEXT,
    sat_certificate_no  TEXT,
    timbre_date         TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','TIMBRADO','CANCELLED')),
    cancelled_at        TIMESTAMPTZ,
    cancellation_reason TEXT,
    xml_path            TEXT,
    pdf_path            TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cfdi_customer ON cfdi (customer_id);
CREATE INDEX idx_cfdi_order ON cfdi (order_id);
CREATE INDEX idx_cfdi_uuid ON cfdi (uuid);

CREATE TABLE cfdi_items (
    cfdi_item_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cfdi_id             BIGINT NOT NULL REFERENCES cfdi(cfdi_id) ON DELETE CASCADE,
    order_item_id       BIGINT REFERENCES order_items(order_item_id),
    line_number         SMALLINT NOT NULL,
    sat_product_key_id  BIGINT NOT NULL REFERENCES sat_product_keys(key_id),
    sat_unit_id         BIGINT NOT NULL REFERENCES sat_unit_keys(unit_id),
    product_id          BIGINT REFERENCES products(product_id),
    sku                 TEXT,
    description         TEXT NOT NULL,
    quantity            NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
    unit_price          NUMERIC(14,4) NOT NULL,
    discount            NUMERIC(14,4) NOT NULL DEFAULT 0,
    subtotal            NUMERIC(14,4) NOT NULL,
    iva_pct             NUMERIC(5,2) NOT NULL DEFAULT 16,
    iva_amount          NUMERIC(14,4) NOT NULL DEFAULT 0,
    ieps_pct            NUMERIC(5,2),
    ieps_amount         NUMERIC(14,4),
    isr_retention_pct   NUMERIC(5,2),
    isr_retention_amount NUMERIC(14,4),
    iva_retention_pct   NUMERIC(5,2),
    iva_retention_amount NUMERIC(14,4),
    total               NUMERIC(14,4) NOT NULL,
    UNIQUE (cfdi_id, line_number)
);

CREATE TABLE cfdi_credit_notes (
    credit_note_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    credit_cfdi_id      BIGINT NOT NULL UNIQUE REFERENCES cfdi(cfdi_id),
    related_cfdi_id     BIGINT NOT NULL REFERENCES cfdi(cfdi_id),
    relation_type       TEXT NOT NULL DEFAULT '01' CHECK (relation_type IN ('01','02','03','04','05','06','07')),
    reason              TEXT NOT NULL,
    refund_amount       NUMERIC(14,4) NOT NULL CHECK (refund_amount > 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cfdi_payments (
    cfdi_payment_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_cfdi_id     BIGINT NOT NULL REFERENCES cfdi(cfdi_id),
    related_cfdi_id     BIGINT NOT NULL REFERENCES cfdi(cfdi_id),
    payment_date        TIMESTAMPTZ NOT NULL,
    payment_form_id     TEXT NOT NULL REFERENCES sat_payment_forms(form_id),
    currency            CHAR(3) NOT NULL DEFAULT 'MXN',
    exchange_rate       NUMERIC(14,6) NOT NULL DEFAULT 1,
    payment_amount      NUMERIC(14,4) NOT NULL CHECK (payment_amount > 0),
    partiality_number   SMALLINT NOT NULL DEFAULT 1,
    previous_balance    NUMERIC(14,4) NOT NULL,
    paid_amount         NUMERIC(14,4) NOT NULL,
    remaining_balance   NUMERIC(14,4) NOT NULL
);

CREATE TABLE payments (
    payment_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_number      TEXT UNIQUE,
    customer_id         BIGINT NOT NULL REFERENCES customers(customer_id),
    payment_date        DATE NOT NULL,
    payment_form_id     TEXT REFERENCES sat_payment_forms(form_id),
    bank_reference      TEXT,
    currency            CHAR(3) NOT NULL DEFAULT 'MXN',
    exchange_rate       NUMERIC(14,6) NOT NULL DEFAULT 1,
    amount              NUMERIC(14,4) NOT NULL CHECK (amount > 0),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_applications (
    application_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_id          BIGINT NOT NULL REFERENCES payments(payment_id) ON DELETE CASCADE,
    cfdi_id             BIGINT REFERENCES cfdi(cfdi_id),
    order_id            BIGINT REFERENCES orders(order_id),
    amount_applied      NUMERIC(14,4) NOT NULL CHECK (amount_applied > 0),
    CHECK ((cfdi_id IS NOT NULL) OR (order_id IS NOT NULL))
);

CREATE TABLE operating_expenses (
    expense_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    expense_number      TEXT,
    supplier_id         BIGINT REFERENCES suppliers(supplier_id),
    supplier_rfc        CITEXT,
    concept             TEXT NOT NULL,
    category            TEXT NOT NULL,
    expense_date        DATE NOT NULL,
    invoice_folio       TEXT,
    is_deductible       BOOLEAN NOT NULL DEFAULT TRUE,
    payment_method      TEXT,
    status              TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','PAID','CANCELLED')),
    responsible_user_id BIGINT REFERENCES users(user_id),
    subtotal            NUMERIC(14,4) NOT NULL,
    tax_amount          NUMERIC(14,4) NOT NULL DEFAULT 0,
    total               NUMERIC(14,4) NOT NULL,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =====================================================================
-- 12. NOTAS DE REMISIÓN (cotización informal con entrega física)
-- =====================================================================

-- Una NR es una "cotización informal" + entrega física a crédito.
-- Siempre se transforma en 1+ cotizaciones formales (quotes).
-- Una NR puede dividirse en varias quotes; varias NRs pueden agruparse en una quote.

CREATE TABLE delivery_notes (
    delivery_note_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    note_number           TEXT NOT NULL UNIQUE,
    customer_id           BIGINT NOT NULL REFERENCES customers(customer_id),
    shipping_address_id   BIGINT REFERENCES customer_addresses(address_id),  -- DELIVERY
    sales_rep_id          BIGINT REFERENCES users(user_id),
    issue_date            DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date         DATE,                              -- cuándo se entregó físicamente
    status                TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','ISSUED','DELIVERED','TRANSFORMED','PARTIALLY_INVOICED','INVOICED','CANCELLED')),
    -- PO del cliente (la OC que justifica la facturación, llega después de la entrega)
    customer_po_number    TEXT,
    customer_po_date      DATE,
    -- Totales (snapshot informal)
    subtotal              NUMERIC(14,4) NOT NULL DEFAULT 0,
    tax_amount            NUMERIC(14,4) NOT NULL DEFAULT 0,
    total                 NUMERIC(14,4) NOT NULL DEFAULT 0,
    notes                 TEXT,
    cancelled_at          TIMESTAMPTZ,
    cancellation_reason   TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status <> 'CANCELLED' OR (cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL))
);
CREATE INDEX idx_dn_customer ON delivery_notes (customer_id);
CREATE INDEX idx_dn_status ON delivery_notes (status);
COMMENT ON TABLE delivery_notes IS
  'Notas de remisión: cotización informal con entrega física. Siempre se transforma en 1+ cotizaciones formales.';

CREATE TABLE delivery_note_items (
    delivery_note_item_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    delivery_note_id      BIGINT NOT NULL REFERENCES delivery_notes(delivery_note_id) ON DELETE CASCADE,
    line_number           SMALLINT NOT NULL,
    product_id            BIGINT NOT NULL REFERENCES products(product_id),
    product_configuration_id BIGINT REFERENCES product_configurations(configuration_id),
    quantity              NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
    quantity_invoiced     NUMERIC(14,4) NOT NULL DEFAULT 0,  -- cuánto ya se facturó
    unit_price_sale       NUMERIC(14,4) NOT NULL,
    discount_pct          NUMERIC(5,2) NOT NULL DEFAULT 0,
    tax_pct               NUMERIC(5,2) NOT NULL DEFAULT 16,
    subtotal              NUMERIC(14,4) NOT NULL DEFAULT 0,
    tax_amount            NUMERIC(14,4) NOT NULL DEFAULT 0,
    total                 NUMERIC(14,4) NOT NULL DEFAULT 0,
    notes                 TEXT,
    UNIQUE (delivery_note_id, line_number),
    CHECK (quantity_invoiced <= quantity)
);
CREATE INDEX idx_dni_dn ON delivery_note_items (delivery_note_id);

-- Tabla puente N:N: una NR puede generar varias quotes, una quote puede agrupar varias NRs
CREATE TABLE quote_delivery_notes (
    quote_id          BIGINT NOT NULL REFERENCES quotes(quote_id) ON DELETE CASCADE,
    delivery_note_id  BIGINT NOT NULL REFERENCES delivery_notes(delivery_note_id),
    associated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    associated_by     BIGINT REFERENCES users(user_id),
    notes             TEXT,
    PRIMARY KEY (quote_id, delivery_note_id)
);
COMMENT ON TABLE quote_delivery_notes IS
  'Junction N:N. Documenta qué cotizaciones formalizaron qué NRs.';


-- =====================================================================
-- 13. CFDI: cancelación/sustitución y motivo SAT
-- =====================================================================

ALTER TABLE cfdi
    ADD COLUMN replaces_cfdi_id   BIGINT REFERENCES cfdi(cfdi_id),
    ADD COLUMN replaced_by_cfdi_id BIGINT REFERENCES cfdi(cfdi_id),
    ADD COLUMN sat_cancellation_motive TEXT
        CHECK (sat_cancellation_motive IN ('01','02','03','04')),
    ADD COLUMN sat_cancellation_uuid_substitute TEXT;
COMMENT ON COLUMN cfdi.sat_cancellation_motive IS
  '01=Comprobante con errores con relación. 02=Sin relación. 03=No se llevó a cabo. 04=Nominativa global.';


-- =====================================================================
-- 14. ORDERS: estado de empacado y asignación
-- =====================================================================

ALTER TABLE orders
    ADD COLUMN packing_status TEXT
        CHECK (packing_status IN ('NOT_STARTED','IN_PROGRESS','READY','PACKED_FOR_ROUTE','DISPATCHED')),
    ADD COLUMN assigned_packer_user_id BIGINT REFERENCES users(user_id);


-- =====================================================================
-- 15. LOGÍSTICA: fleteras, envíos, tracking, rutas
-- =====================================================================

CREATE TABLE carriers (
    carrier_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                  TEXT NOT NULL UNIQUE,
    name                  TEXT NOT NULL,
    contact_name          TEXT,
    phone                 TEXT,
    email                 CITEXT,
    tracking_url_template TEXT,                    -- 'https://carrier.com/track?n={tracking}'
    is_internal           BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = nuestra propia camioneta
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shipments (
    shipment_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shipment_number       TEXT NOT NULL UNIQUE,
    order_id              BIGINT NOT NULL REFERENCES orders(order_id),
    delivery_note_id      BIGINT REFERENCES delivery_notes(delivery_note_id),
    customer_address_id   BIGINT REFERENCES customer_addresses(address_id),
    carrier_id            BIGINT REFERENCES carriers(carrier_id),
    tracking_number       TEXT,
    tracking_url          TEXT,
    status                TEXT NOT NULL DEFAULT 'PREPARING'
        CHECK (status IN ('PREPARING','READY','IN_TRANSIT','DELIVERED','RETURNED','INCIDENT','CANCELLED')),
    shipping_cost         NUMERIC(14,4) NOT NULL DEFAULT 0,
    shipping_date         TIMESTAMPTZ,
    estimated_arrival     TIMESTAMPTZ,
    actual_arrival        TIMESTAMPTZ,
    received_by_name      TEXT,
    delivery_evidence_url TEXT,
    incident_notes        TEXT,
    notes                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shipments_order ON shipments (order_id);
CREATE INDEX idx_shipments_status ON shipments (status);

CREATE TABLE shipment_items (
    shipment_item_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shipment_id      BIGINT NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    order_item_id    BIGINT NOT NULL REFERENCES order_items(order_item_id),
    quantity         NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
    UNIQUE (shipment_id, order_item_id)
);

CREATE TABLE shipment_tracking_events (
    event_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shipment_id   BIGINT NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    event_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
    location      TEXT,
    status_code   TEXT,
    description   TEXT NOT NULL,
    source        TEXT NOT NULL DEFAULT 'MANUAL'
        CHECK (source IN ('MANUAL','API','IMPORT')),
    recorded_by   BIGINT REFERENCES users(user_id)
);
CREATE INDEX idx_tracking_shipment ON shipment_tracking_events (shipment_id, event_date DESC);

-- Rutas (combinan entregas a clientes + recolecciones a proveedores)
CREATE TABLE routes (
    route_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    route_number      TEXT NOT NULL UNIQUE,
    route_date        DATE NOT NULL,
    driver_user_id    BIGINT REFERENCES users(user_id),
    vehicle_plate     TEXT,
    vehicle_label     TEXT,                              -- "Camioneta 1", "Camión 2"
    status            TEXT NOT NULL DEFAULT 'PLANNING'
        CHECK (status IN ('PLANNING','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED')),
    start_time        TIMESTAMPTZ,
    end_time          TIMESTAMPTZ,
    total_distance_km NUMERIC(10,2),
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE route_stops (
    stop_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    route_id            BIGINT NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
    stop_order          SMALLINT NOT NULL,
    stop_type           TEXT NOT NULL CHECK (stop_type IN ('DELIVERY','PICKUP')),
    -- Si DELIVERY:
    customer_address_id BIGINT REFERENCES customer_addresses(address_id),
    shipment_id         BIGINT REFERENCES shipments(shipment_id),
    -- Si PICKUP:
    supplier_address_id BIGINT REFERENCES supplier_addresses(address_id),
    purchase_order_id   BIGINT REFERENCES purchase_orders(po_id),
    goods_receipt_id    BIGINT REFERENCES goods_receipts(receipt_id),
    -- Tiempos
    estimated_arrival   TIMESTAMPTZ,
    actual_arrival      TIMESTAMPTZ,
    actual_departure    TIMESTAMPTZ,
    -- Estado
    status              TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','EN_ROUTE','ARRIVED','COMPLETED','FAILED','SKIPPED')),
    failure_reason      TEXT,
    notes               TEXT,
    UNIQUE (route_id, stop_order),
    CHECK (
        (stop_type = 'DELIVERY' AND shipment_id IS NOT NULL AND purchase_order_id IS NULL)
        OR (stop_type = 'PICKUP' AND purchase_order_id IS NOT NULL AND shipment_id IS NULL)
    )
);
CREATE INDEX idx_route_stops_route ON route_stops (route_id, stop_order);


-- =====================================================================
-- 16. COMPRAS — extensiones: tipo de item, servicios, SAT payments
-- =====================================================================

-- 16.1 purchase_orders: tipo (bienes, servicios, mixto)
ALTER TABLE purchase_orders
    ADD COLUMN po_type TEXT NOT NULL DEFAULT 'GOODS'
        CHECK (po_type IN ('GOODS','SERVICES','MIXED'));
COMMENT ON COLUMN purchase_orders.po_type IS
  'GOODS = bienes (genera goods_receipt). SERVICES = servicios (no genera GR). MIXED = ambos.';

-- 16.2 purchase_request_items: soporte para servicios y tipo
ALTER TABLE purchase_request_items
    ALTER COLUMN product_id DROP NOT NULL,
    ADD COLUMN item_type TEXT NOT NULL DEFAULT 'GOODS_RESALE'
        CHECK (item_type IN ('GOODS_RESALE','GOODS_INTERNAL','SERVICE')),
    ADD COLUMN service_description TEXT,
    ADD COLUMN unit_of_measure TEXT,
    ADD CONSTRAINT chk_pri_product_or_service CHECK (
        (item_type IN ('GOODS_RESALE','GOODS_INTERNAL') AND product_id IS NOT NULL)
        OR (item_type = 'SERVICE' AND service_description IS NOT NULL)
    );
COMMENT ON COLUMN purchase_request_items.item_type IS
  'GOODS_RESALE = inventario para venta. GOODS_INTERNAL = consumo interno. SERVICE = servicio (sin product_id).';

-- 16.3 purchase_order_items: igual
ALTER TABLE purchase_order_items
    ALTER COLUMN product_id DROP NOT NULL,
    ADD COLUMN item_type TEXT NOT NULL DEFAULT 'GOODS_RESALE'
        CHECK (item_type IN ('GOODS_RESALE','GOODS_INTERNAL','SERVICE')),
    ADD COLUMN service_description TEXT,
    ADD COLUMN unit_of_measure TEXT,
    ADD CONSTRAINT chk_poi_product_or_service CHECK (
        (item_type IN ('GOODS_RESALE','GOODS_INTERNAL') AND product_id IS NOT NULL)
        OR (item_type = 'SERVICE' AND service_description IS NOT NULL)
    );

-- 16.4 supplier_invoices: SAT payment fields
ALTER TABLE supplier_invoices
    ADD COLUMN invoice_type TEXT NOT NULL DEFAULT 'GOODS'
        CHECK (invoice_type IN ('GOODS','SERVICES','MIXED')),
    ADD COLUMN sat_payment_form_id   TEXT REFERENCES sat_payment_forms(form_id),
    ADD COLUMN sat_payment_method_id TEXT REFERENCES sat_payment_methods(method_id),
    ADD COLUMN is_credit BOOLEAN GENERATED ALWAYS AS (sat_payment_method_id = 'PPD') STORED;
COMMENT ON COLUMN supplier_invoices.sat_payment_form_id IS
  'Forma de pago SAT (catálogo c_FormaPago): 01=Efectivo, 03=Transferencia, 04=Tarjeta crédito, 06=Dinero electrónico, 99=Por definir, etc.';
COMMENT ON COLUMN supplier_invoices.sat_payment_method_id IS
  'Método de pago SAT: PUE = Pago en Una Exhibición (contado). PPD = Pago en Parcialidades o Diferido (crédito).';
COMMENT ON COLUMN supplier_invoices.is_credit IS
  'Derivado: TRUE si sat_payment_method_id = PPD.';

-- 16.5 supplier_invoice_items: soporte servicios
ALTER TABLE supplier_invoice_items
    ALTER COLUMN product_id DROP NOT NULL,
    ADD COLUMN item_type TEXT NOT NULL DEFAULT 'GOODS_RESALE'
        CHECK (item_type IN ('GOODS_RESALE','GOODS_INTERNAL','SERVICE')),
    ADD COLUMN concept_description TEXT,
    ADD CONSTRAINT chk_sii_product_or_service CHECK (
        (item_type IN ('GOODS_RESALE','GOODS_INTERNAL') AND product_id IS NOT NULL)
        OR (item_type = 'SERVICE' AND concept_description IS NOT NULL)
    );

-- 16.6 goods_receipts: hacer obligatoria la PO
ALTER TABLE goods_receipts
    ALTER COLUMN po_id SET NOT NULL;

-- 16.7 goods_receipt_items: hacer obligatoria la PO item
ALTER TABLE goods_receipt_items
    ALTER COLUMN po_item_id SET NOT NULL;

-- 16.8 operating_expenses: agregar SAT payment fields
ALTER TABLE operating_expenses
    ADD COLUMN sat_payment_form_id   TEXT REFERENCES sat_payment_forms(form_id),
    ADD COLUMN sat_payment_method_id TEXT REFERENCES sat_payment_methods(method_id),
    ADD COLUMN is_credit BOOLEAN GENERATED ALWAYS AS (sat_payment_method_id = 'PPD') STORED,
    ADD COLUMN uuid_sat TEXT;


-- =====================================================================
-- 17. INVENTARIO INTERNO (productos no vendibles)
-- =====================================================================

-- Flag: producto disponible para venta o solo uso interno
ALTER TABLE products
    ADD COLUMN is_saleable BOOLEAN NOT NULL DEFAULT TRUE;
COMMENT ON COLUMN products.is_saleable IS
  'TRUE = producto vendible (cotizaciones, ventas). FALSE = solo uso interno (inventario sí, ventas no).';

-- Índice parcial para queries del catálogo de ventas (excluye internos)
CREATE INDEX idx_products_saleable ON products (sku) WHERE is_saleable AND is_active;


-- =====================================================================
-- 18. ASSETS (equipos con partes intercambiables)
-- =====================================================================

CREATE TABLE assets (
    asset_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_code        TEXT NOT NULL UNIQUE,            -- 'PC-001', 'IMP-005', 'MAQ-PR-002'
    asset_type        TEXT NOT NULL                    -- COMPUTER, PRINTER, MACHINE, VEHICLE, OTHER
        CHECK (asset_type IN ('COMPUTER','LAPTOP','PRINTER','MACHINE','VEHICLE','TOOL','OTHER')),
    name              TEXT NOT NULL,                   -- "PC oficina ventas — Diego"
    base_product_id   BIGINT REFERENCES products(product_id),  -- si es un modelo del catálogo
    serial_number     TEXT,
    manufacturer      TEXT,
    model             TEXT,
    location          TEXT,                            -- 'Oficina principal', 'Planta'
    assigned_user_id  BIGINT REFERENCES users(user_id),
    status            TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE','IN_REPAIR','IDLE','RETIRED','DISMANTLED')),
    purchase_date     DATE,
    purchase_cost     NUMERIC(14,4),
    warranty_until    DATE,
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assets_code ON assets (asset_code);
CREATE INDEX idx_assets_status ON assets (status);
COMMENT ON TABLE assets IS
  'Equipo físico con identidad propia (PC, máquinas). Distinto a productos en inventario porque cada uno es único y cambia internamente.';

-- Componentes actualmente instalados (estado actual)
CREATE TABLE asset_components (
    asset_component_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_id           BIGINT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    product_id         BIGINT NOT NULL REFERENCES products(product_id),
    quantity           NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    serial_number      TEXT,                          -- si la parte tiene serial propio (ej. disco)
    installed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    installed_by       BIGINT REFERENCES users(user_id),
    notes              TEXT
);
CREATE INDEX idx_asset_components_asset ON asset_components (asset_id);
CREATE INDEX idx_asset_components_product ON asset_components (product_id);

-- Histórico inmutable de cada instalación / removida (audit trail)
CREATE TABLE asset_component_history (
    history_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_id             BIGINT NOT NULL REFERENCES assets(asset_id),
    product_id           BIGINT NOT NULL REFERENCES products(product_id),
    operation            TEXT NOT NULL CHECK (operation IN ('INSTALL','REMOVE','REPLACE')),
    quantity             NUMERIC(14,4) NOT NULL,
    serial_number        TEXT,
    occurred_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id              BIGINT REFERENCES users(user_id),
    inventory_movement_id BIGINT REFERENCES inventory_movements(movement_id),
    nc_id                BIGINT REFERENCES non_conformities(nc_id),  -- si la pieza salió defectuosa
    reason               TEXT,
    notes                TEXT
);
CREATE INDEX idx_ach_asset ON asset_component_history (asset_id, occurred_at DESC);


-- =====================================================================
-- 19. NON-CONFORMITIES — extensión: origen y vínculo a asset
-- =====================================================================

ALTER TABLE non_conformities
    ADD COLUMN nc_source TEXT NOT NULL DEFAULT 'SUPPLIER'
        CHECK (nc_source IN ('SUPPLIER','CUSTOMER_RETURN','ASSET_REMOVAL','PHYSICAL_COUNT','OTHER')),
    ADD COLUMN asset_id BIGINT REFERENCES assets(asset_id);
COMMENT ON COLUMN non_conformities.nc_source IS
  'SUPPLIER = recibido defectuoso. CUSTOMER_RETURN = devuelto por cliente. ASSET_REMOVAL = pieza retirada de equipo. PHYSICAL_COUNT = ajuste por conteo. OTHER = otros.';


-- =====================================================================
-- 20. CFDI 4.0 — emisor, series, bitácora PAC
-- =====================================================================

-- Configuración del emisor (la empresa de RTB)
-- Múltiples filas si se manejan varias razones sociales propias o si cambia algún dato
CREATE TABLE cfdi_issuer_config (
    config_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rfc                    CITEXT NOT NULL,
    legal_name             TEXT NOT NULL,
    tax_regime_id          SMALLINT NOT NULL REFERENCES sat_tax_regimes(regime_id),
    zip_code               TEXT NOT NULL,
    place_of_issue_zip     TEXT NOT NULL,                -- LugarExpedicion (puede diferir de zip fiscal)
    -- Credenciales CSD (Certificado de Sello Digital)
    csd_certificate_path   TEXT,                          -- ruta al .cer
    csd_key_path           TEXT,                          -- ruta al .key
    csd_password_encrypted TEXT,                          -- contraseña cifrada (vault, KMS, etc.)
    csd_serial_number      TEXT,                          -- # de serie del CSD
    csd_valid_from         DATE,
    csd_valid_to           DATE,
    -- PAC
    pac_provider           TEXT,                          -- 'Diverza', 'Edicom', 'Facturama', etc.
    pac_username           TEXT,
    pac_endpoint_url       TEXT,
    pac_credentials_encrypted TEXT,
    pac_environment        TEXT NOT NULL DEFAULT 'PRODUCTION'
        CHECK (pac_environment IN ('SANDBOX','PRODUCTION')),
    -- Estado
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from             DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to               DATE,
    notes                  TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE cfdi_issuer_config IS
  'Datos fiscales y credenciales de la empresa emisora. Si el RFC cambia, se cierra config anterior y se abre una nueva.';

-- Series y consecutivos de folio
CREATE TABLE cfdi_series (
    series_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    series        TEXT NOT NULL UNIQUE,                  -- 'A', 'NC', 'CP', 'EXP'
    cfdi_type     CHAR(1) NOT NULL CHECK (cfdi_type IN ('I','E','P','T')),
    description   TEXT,
    next_folio    BIGINT NOT NULL DEFAULT 1 CHECK (next_folio > 0),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE cfdi_series IS
  'Series y folios consecutivos. Ejemplos: A=Ingreso, NC=Egreso/Nota Crédito, CP=Pago, EXP=Exportación.';

-- Bitácora de intentos de timbrado con el PAC (auditoría y debugging)
CREATE TABLE cfdi_pac_log (
    log_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cfdi_id           BIGINT NOT NULL REFERENCES cfdi(cfdi_id) ON DELETE CASCADE,
    operation         TEXT NOT NULL CHECK (operation IN ('TIMBRAR','CANCELAR','CONSULTAR_ESTATUS','REPROCESAR')),
    attempt_number    SMALLINT NOT NULL DEFAULT 1,
    attempt_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    pac_provider      TEXT,
    request_payload   TEXT,                              -- el XML enviado (truncar a N kb si es grande)
    response_payload  TEXT,                              -- respuesta del PAC (XML/JSON)
    success           BOOLEAN NOT NULL,
    error_code        TEXT,
    error_message     TEXT,
    uuid_received     TEXT,
    sello_sat         TEXT,
    user_id           BIGINT REFERENCES users(user_id)
);
CREATE INDEX idx_pac_log_cfdi ON cfdi_pac_log (cfdi_id, attempt_at DESC);
COMMENT ON TABLE cfdi_pac_log IS
  'Bitácora de operaciones con el PAC: timbrado, cancelación, consulta. Útil para debugging y auditoría.';


-- Vincular series con CFDIs ya emitidos (FK nullable porque puede existir CFDI sin serie en migración)
ALTER TABLE cfdi
    ADD COLUMN series_id BIGINT REFERENCES cfdi_series(series_id),
    ADD COLUMN issuer_config_id BIGINT REFERENCES cfdi_issuer_config(config_id);


-- =====================================================================
-- 21. FKs CIRCULARES (agregadas al final con ALTER TABLE)
-- =====================================================================

-- quote_items.cost_source_po_id depende de purchase_orders, que se crea después
ALTER TABLE quote_items
    ADD CONSTRAINT fk_quote_items_cost_source_po
    FOREIGN KEY (cost_source_po_id) REFERENCES purchase_orders(po_id);


-- =====================================================================
-- FIN DEL DDL PRINCIPAL
-- Ver 04_views_and_triggers.sql para vistas, triggers y funciones
-- =====================================================================

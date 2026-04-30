-- =====================================================================
-- RTB · Seed inicial del módulo de Productos y Pricing
-- Ejecutar después de seed_seguridad.sql y de cargar catálogos SAT
-- =====================================================================
SET search_path = rtb, public;

-- ─────────────────────────────────────────────────────────────────────
-- 1) MARCAS (ejemplo — reemplazar con marcas reales del Notion viejo)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO brands (name) VALUES
  ('Siemens'),
  ('ABB'),
  ('Festo'),
  ('SMC'),
  ('Bosch Rexroth'),
  ('Parker Hannifin'),
  ('Schneider Electric'),
  ('Eaton'),
  ('Genérica')
ON CONFLICT (name) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 2) CATEGORÍAS con margen
--    Validar contigo antes de producción la matriz de márgenes correcta
-- ─────────────────────────────────────────────────────────────────────
-- Categorías raíz
INSERT INTO categories (name, slug, profit_margin_pct, parent_id) VALUES
  ('Neumática',              'neumatica',              35.00, NULL),
  ('Eléctrica',              'electrica',              28.00, NULL),
  ('Hidráulica',             'hidraulica',             40.00, NULL),
  ('Automatización',         'automatizacion',         32.00, NULL),
  ('Refacciones genéricas',  'refacciones-genericas',  22.00, NULL),
  ('Refacciones especiales', 'refacciones-especiales',  0.00, NULL)  -- PASSTHROUGH típicamente
ON CONFLICT (slug) DO NOTHING;

-- Subcategorías de Neumática
INSERT INTO categories (name, slug, profit_margin_pct, parent_id)
SELECT v.name, v.slug, v.margin, p.category_id
FROM (VALUES
  ('Cilindros',  'neumatica-cilindros',  35.00),
  ('Válvulas',   'neumatica-valvulas',   35.00),
  ('Filtros y unidades de mantenimiento', 'neumatica-fum', 35.00)
) AS v(name, slug, margin)
JOIN categories p ON p.slug = 'neumatica'
ON CONFLICT (slug) DO NOTHING;

-- Subcategorías de Eléctrica
INSERT INTO categories (name, slug, profit_margin_pct, parent_id)
SELECT v.name, v.slug, v.margin, p.category_id
FROM (VALUES
  ('Variadores de frecuencia', 'electrica-variadores', 28.00),
  ('Contactores y relés',      'electrica-contactores', 28.00),
  ('Tableros',                 'electrica-tableros',    28.00)
) AS v(name, slug, margin)
JOIN categories p ON p.slug = 'electrica'
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 3) PRODUCTOS DE EJEMPLO con cada estrategia de pricing
--    REEMPLAZAR con datos reales en migración
-- ─────────────────────────────────────────────────────────────────────

-- Producto 1: Compresor configurable (MOVING_AVG)
INSERT INTO products (
    sku, internal_code, name, description,
    brand_id, category_id,
    is_configurable, is_assembled, package_size, min_stock,
    pricing_strategy, moving_avg_months
)
SELECT
    'CMP-XS200', 'INT-CMP200',
    'Compresor industrial XS-200',
    'Compresor de tornillo, configurable por voltaje, color y capacidad.',
    (SELECT brand_id    FROM brands     WHERE name = 'Siemens'),
    (SELECT category_id FROM categories WHERE slug = 'neumatica'),
    TRUE, TRUE, 1, 2,
    'MOVING_AVG', 6
ON CONFLICT (sku) DO NOTHING;

-- Producto 2: Refacción tipo PASSTHROUGH (se vende al costo, sin margen)
INSERT INTO products (
    sku, internal_code, name, description,
    brand_id, category_id,
    is_configurable, is_assembled, min_stock,
    pricing_strategy, moving_avg_months
)
SELECT
    'RFC-O-RING-25', 'INT-OR25',
    'O-Ring 25mm — pedido especial cliente',
    'Refacción específica que se factura al costo, sin margen.',
    (SELECT brand_id    FROM brands     WHERE name = 'Genérica'),
    (SELECT category_id FROM categories WHERE slug = 'refacciones-especiales'),
    FALSE, FALSE, 0,
    'PASSTHROUGH', 6
ON CONFLICT (sku) DO NOTHING;

-- Producto 3: Refacción común con margen (default)
INSERT INTO products (
    sku, internal_code, name,
    brand_id, category_id, min_stock
)
SELECT
    'KIT-SELLOS-A', 'INT-KSA',
    'Kit de sellos tipo A',
    (SELECT brand_id    FROM brands     WHERE name = 'Genérica'),
    (SELECT category_id FROM categories WHERE slug = 'refacciones-genericas'),
    5
ON CONFLICT (sku) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 4) ATRIBUTOS CONFIGURABLES del Compresor XS-200
-- ─────────────────────────────────────────────────────────────────────
WITH p AS (SELECT product_id FROM products WHERE sku = 'CMP-XS200')
INSERT INTO product_attributes (product_id, name, data_type, is_required, sort_order)
SELECT p.product_id, v.name, v.dtype, v.required, v.ord
FROM p, (VALUES
  ('Voltaje',       'OPTION',  TRUE,  1),
  ('Color',         'OPTION',  FALSE, 2),
  ('Capacidad (L)', 'NUMBER',  TRUE,  3),
  ('Garantía extendida', 'BOOLEAN', FALSE, 4)
) AS v(name, dtype, required, ord)
ON CONFLICT (product_id, name) DO NOTHING;

-- Opciones del atributo Voltaje
WITH a AS (
    SELECT pa.attribute_id
    FROM product_attributes pa
    JOIN products p ON p.product_id = pa.product_id
    WHERE p.sku = 'CMP-XS200' AND pa.name = 'Voltaje'
)
INSERT INTO product_attribute_options (attribute_id, value, extra_cost)
SELECT a.attribute_id, v.value, v.cost
FROM a, (VALUES ('110V', 0), ('220V', 1500), ('440V', 3000)) AS v(value, cost)
ON CONFLICT (attribute_id, value) DO NOTHING;

-- Opciones del atributo Color
WITH a AS (
    SELECT pa.attribute_id
    FROM product_attributes pa
    JOIN products p ON p.product_id = pa.product_id
    WHERE p.sku = 'CMP-XS200' AND pa.name = 'Color'
)
INSERT INTO product_attribute_options (attribute_id, value, extra_cost)
SELECT a.attribute_id, v.value, v.cost
FROM a, (VALUES ('Rojo', 0), ('Azul', 0), ('Personalizado', 800)) AS v(value, cost)
ON CONFLICT (attribute_id, value) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 5) BOM del Compresor XS-200 (versión 1)
--    Asume que existen los productos componentes (MOTOR-5HP, etc.)
-- ─────────────────────────────────────────────────────────────────────
-- Crear BOM
INSERT INTO bom (product_id, version, is_active, notes)
SELECT product_id, 1, TRUE, 'BOM inicial del XS-200, vigente desde migración.'
FROM products WHERE sku = 'CMP-XS200'
ON CONFLICT (product_id, version) DO NOTHING;

-- Aquí irían los componentes — comentado porque depende de que existan los SKUs
-- WITH b AS (SELECT bom_id FROM bom JOIN products USING (product_id) WHERE sku = 'CMP-XS200' AND version = 1)
-- INSERT INTO bom_items (bom_id, component_id, quantity)
-- SELECT b.bom_id, p.product_id, v.qty
-- FROM b, products p, (VALUES
--   ('MOTOR-5HP',  1),
--   ('TANK-100L',  1),
--   ('MANOMETRO',  2),
--   ('VALV-SEG',   1),
--   ('KIT-TORN',   1)
-- ) AS v(sku, qty)
-- WHERE p.sku = v.sku;


-- ─────────────────────────────────────────────────────────────────────
-- 6) SALDO INICIAL DE INVENTARIO con costo
--    Esto dispara fn_recalc_product_avg_cost y popula current_avg_cost
-- ─────────────────────────────────────────────────────────────────────
-- Asume que existen los productos. Reemplazar las cantidades y costos por los reales.
INSERT INTO inventory_movements (
    product_id, movement_type, source_type, source_id,
    quantity_in, unit_cost, occurred_at, notes
)
SELECT p.product_id, 'OPENING_BALANCE', 'OPENING', NULL,
       v.qty, v.cost, '2026-04-27 00:00:00'::TIMESTAMPTZ,
       'Saldo inicial de migración Notion → PG'
FROM products p, (VALUES
    ('CMP-XS200',     5, 41000.0000),    -- 5 unidades a $41,000 promedio
    ('RFC-O-RING-25', 200, 250.0000),    -- 200 unidades a $250 c/u
    ('KIT-SELLOS-A',  30,  1200.0000)    -- 30 kits a $1,200 c/u
) AS v(sku, qty, cost)
WHERE p.sku = v.sku;


-- ─────────────────────────────────────────────────────────────────────
-- 7) EJEMPLO DE CONVENIO ARIBA
--    Asume que existe un cliente con code = 'BIMBO' (cargar primero clientes)
-- ─────────────────────────────────────────────────────────────────────
-- INSERT INTO customer_contract_prices (
--     customer_id, product_id, contract_type, fixed_sale_price,
--     valid_from, last_change_notice, last_changed_by
-- )
-- SELECT c.customer_id, p.product_id, 'ARIBA', 51300.00,
--        CURRENT_DATE,
--        'Convenio firmado 2026-04-15. Correo Bimbo, ref. ARIBA-2026-1234.',
--        (SELECT user_id FROM users WHERE email = 'admin@rtb.com')
-- FROM customers c, products p
-- WHERE c.code = 'BIMBO' AND p.sku = 'CMP-XS200';


-- ─────────────────────────────────────────────────────────────────────
-- 8) VALIDACIONES POST-SEED
-- ─────────────────────────────────────────────────────────────────────

-- Productos con su margen efectivo y precio sugerido
SELECT
    p.sku, p.name, c.name AS category,
    c.profit_margin_pct AS margen_pct,
    p.pricing_strategy,
    p.current_avg_cost  AS costo_actual,
    vp.suggested_sale_price AS precio_sugerido
FROM products p
JOIN categories c ON c.category_id = p.category_id
LEFT JOIN v_product_pricing vp ON vp.product_id = p.product_id
WHERE p.is_active
ORDER BY p.sku;

-- Categorías con cuántos productos contienen
SELECT c.name, c.profit_margin_pct, COUNT(p.product_id) AS productos
FROM categories c
LEFT JOIN products p ON p.category_id = c.category_id AND p.is_active
GROUP BY c.category_id, c.name, c.profit_margin_pct
ORDER BY c.name;

-- Productos PASSTHROUGH (no aplican margen)
SELECT sku, name FROM products WHERE pricing_strategy = 'PASSTHROUGH';

-- Productos sin costo conocido (no han tenido OPENING_BALANCE ni RECEIPT)
SELECT sku, name FROM products
WHERE current_avg_cost IS NULL AND is_active;

-- Histórico de costo registrado por el seed
SELECT p.sku, h.previous_avg_cost, h.new_avg_cost, h.triggered_by, h.recorded_at
FROM product_cost_history h
JOIN products p ON p.product_id = h.product_id
ORDER BY h.recorded_at DESC;

-- Probar fn_get_quote_pricing (requiere customer_id existente)
-- SELECT * FROM fn_get_quote_pricing(
--   (SELECT product_id FROM products WHERE sku = 'CMP-XS200'),
--   1,   -- customer_id de prueba
--   1    -- cantidad
-- );

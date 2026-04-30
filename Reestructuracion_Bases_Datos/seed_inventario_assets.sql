-- =====================================================================
-- RTB · Seed de Inventario, No Conformes y Assets
-- Ejemplos: producto interno (tóner), equipo PC con componentes,
-- cambio de pieza buena, cambio de pieza dañada (no conforme)
-- =====================================================================
SET search_path = rtb, public;

-- ─────────────────────────────────────────────────────────────────────
-- 1) PRODUCTO INTERNO (NO se vende, se consume internamente)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO products (
    sku, name, description,
    brand_id, category_id, is_saleable, min_stock,
    pricing_strategy, moving_avg_months
)
SELECT 'TON-HP-83A', 'Tóner HP 83A negro',
       'Tóner para impresoras de oficina',
       (SELECT brand_id FROM brands WHERE name = 'Genérica'),
       (SELECT category_id FROM categories WHERE slug = 'refacciones-genericas'),
       FALSE,           -- ← NO se vende, solo uso interno
       2,
       'MOVING_AVG', 6
ON CONFLICT (sku) DO NOTHING;

-- Stock inicial (entrada por OPENING_BALANCE)
INSERT INTO inventory_movements (
    product_id, movement_type, source_type, quantity_in, unit_cost, notes
)
SELECT product_id, 'OPENING_BALANCE', 'OPENING', 5, 1200, 'Saldo inicial de migración'
FROM products WHERE sku = 'TON-HP-83A';


-- Componentes para PC (también internos)
INSERT INTO products (sku, name, brand_id, category_id, is_saleable, min_stock)
VALUES
  ('RAM-DDR4-16GB', 'RAM DDR4 16GB',
    (SELECT brand_id FROM brands WHERE name = 'Genérica'),
    (SELECT category_id FROM categories WHERE slug = 'refacciones-genericas'),
    FALSE, 2),
  ('RAM-DDR4-32GB', 'RAM DDR4 32GB',
    (SELECT brand_id FROM brands WHERE name = 'Genérica'),
    (SELECT category_id FROM categories WHERE slug = 'refacciones-genericas'),
    FALSE, 1),
  ('SSD-1TB',       'SSD NVMe 1TB',
    (SELECT brand_id FROM brands WHERE name = 'Genérica'),
    (SELECT category_id FROM categories WHERE slug = 'refacciones-genericas'),
    FALSE, 1),
  ('SSD-2TB',       'SSD NVMe 2TB',
    (SELECT brand_id FROM brands WHERE name = 'Genérica'),
    (SELECT category_id FROM categories WHERE slug = 'refacciones-genericas'),
    FALSE, 1)
ON CONFLICT (sku) DO NOTHING;

-- Stock inicial de componentes
INSERT INTO inventory_movements (product_id, movement_type, source_type, quantity_in, unit_cost, notes)
SELECT p.product_id, 'OPENING_BALANCE', 'OPENING', v.qty, v.cost, 'Saldo inicial'
FROM products p, (VALUES
    ('RAM-DDR4-16GB', 4, 1500),
    ('RAM-DDR4-32GB', 3, 2800),
    ('SSD-1TB',       2, 2200),
    ('SSD-2TB',       2, 3800)
) AS v(sku, qty, cost)
WHERE p.sku = v.sku;


-- ─────────────────────────────────────────────────────────────────────
-- 2) ASSETS — Equipos físicos
-- ─────────────────────────────────────────────────────────────────────

-- PC de oficina asignada a Diego
INSERT INTO assets (
    asset_code, asset_type, name, manufacturer, model,
    serial_number, location, assigned_user_id, status,
    purchase_date, purchase_cost
)
SELECT 'PC-001', 'COMPUTER',
       'PC oficina ventas — Diego', 'Dell', 'OptiPlex 7090',
       'D7090-ABC123',
       'Oficina principal',
       (SELECT user_id FROM users WHERE email = 'admin@rtb.com'),
       'ACTIVE', '2024-06-15', 28000;

-- Configuración inicial: 2 RAMs de 16GB + 1 SSD 1TB
INSERT INTO asset_components (asset_id, product_id, quantity, serial_number, installed_by, notes)
SELECT a.asset_id, p.product_id, v.qty, v.sn,
       (SELECT user_id FROM users WHERE email = 'admin@rtb.com'),
       v.note
FROM assets a, products p, (VALUES
    ('RAM-DDR4-16GB', 2, 'CRC-RAM-001', 'Memoria principal'),
    ('SSD-1TB',       1, 'WD-SSD-001',  'Disco principal')
) AS v(sku, qty, sn, note)
WHERE a.asset_code = 'PC-001' AND p.sku = v.sku;
-- Cada INSERT dispara fn_on_component_install:
-- → inventory_movement ISSUE (sale del stock)
-- → asset_component_history INSERT


-- ─────────────────────────────────────────────────────────────────────
-- 3) UPGRADE: cambiar 2x16GB por 2x32GB (RAM vieja vuelve a stock)
-- ─────────────────────────────────────────────────────────────────────

-- Para cada RAM 16GB instalada, llamar la función de removida con is_reusable=TRUE
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT ac.asset_component_id
        FROM asset_components ac
        JOIN assets a ON a.asset_id = ac.asset_id
        JOIN products p ON p.product_id = ac.product_id
        WHERE a.asset_code = 'PC-001' AND p.sku = 'RAM-DDR4-16GB'
    LOOP
        PERFORM fn_remove_asset_component(
            p_asset_component_id := r.asset_component_id,
            p_is_reusable        := TRUE,
            p_user_id            := (SELECT user_id FROM users WHERE email = 'admin@rtb.com'),
            p_reason             := 'Upgrade — RAM reasignada para otro equipo',
            p_notes              := NULL
        );
    END LOOP;
END $$;

-- Instalar las nuevas RAMs de 32GB
INSERT INTO asset_components (asset_id, product_id, quantity, serial_number, installed_by, notes)
SELECT a.asset_id, p.product_id, 1, 'CRC-RAM32-' || LPAD(g::TEXT, 3, '0'),
       (SELECT user_id FROM users WHERE email = 'admin@rtb.com'),
       'Upgrade DDR4 32GB'
FROM assets a, products p, generate_series(1,2) g
WHERE a.asset_code = 'PC-001' AND p.sku = 'RAM-DDR4-32GB';


-- ─────────────────────────────────────────────────────────────────────
-- 4) FALLA: el SSD se daña; se cambia (la pieza vieja es no conforme)
-- ─────────────────────────────────────────────────────────────────────

-- Quitar el SSD 1TB defectuoso (NO reusable → no_conformity)
DO $$
DECLARE v_id BIGINT;
BEGIN
    SELECT ac.asset_component_id INTO v_id
    FROM asset_components ac
    JOIN assets a ON a.asset_id = ac.asset_id
    JOIN products p ON p.product_id = ac.product_id
    WHERE a.asset_code = 'PC-001' AND p.sku = 'SSD-1TB' LIMIT 1;

    IF v_id IS NOT NULL THEN
        PERFORM fn_remove_asset_component(
            p_asset_component_id := v_id,
            p_is_reusable        := FALSE,                 -- pieza dañada
            p_user_id            := (SELECT user_id FROM users WHERE email = 'admin@rtb.com'),
            p_reason             := 'Sectores dañados, SMART error',
            p_notes              := 'No reparable, para baja'
        );
    END IF;
END $$;

-- Instalar SSD 2TB nuevo
INSERT INTO asset_components (asset_id, product_id, quantity, serial_number, installed_by, notes)
SELECT a.asset_id, p.product_id, 1, 'WD-SSD-002',
       (SELECT user_id FROM users WHERE email = 'admin@rtb.com'),
       'Reemplazo del SSD anterior por falla'
FROM assets a, products p
WHERE a.asset_code = 'PC-001' AND p.sku = 'SSD-2TB';


-- ─────────────────────────────────────────────────────────────────────
-- 5) VALIDACIONES
-- ─────────────────────────────────────────────────────────────────────

-- Inventario vendible
SELECT product_name, quantity_on_hand FROM v_saleable_inventory ORDER BY product_name LIMIT 5;

-- Inventario interno
SELECT product_name, quantity_on_hand FROM v_internal_inventory ORDER BY product_name;

-- Componentes actuales de PC-001 (debe mostrar: 2× RAM 32GB + 1× SSD 2TB)
SELECT component_sku, component_name, quantity, serial_number, installed_at
FROM v_asset_current_components
WHERE asset_code = 'PC-001';

-- Historial completo de PC-001
SELECT occurred_at, operation, component_sku, quantity, performed_by, reason
FROM v_asset_repair_history
WHERE asset_code = 'PC-001'
ORDER BY occurred_at;
-- Esperado:
-- INSTALL  RAM-DDR4-16GB  qty 1  Admin   (instalación inicial)
-- INSTALL  RAM-DDR4-16GB  qty 1  Admin
-- INSTALL  SSD-1TB        qty 1  Admin
-- REMOVE   RAM-DDR4-16GB  qty 1  Admin   reason: Upgrade
-- REMOVE   RAM-DDR4-16GB  qty 1  Admin
-- INSTALL  RAM-DDR4-32GB  qty 1  Admin
-- INSTALL  RAM-DDR4-32GB  qty 1  Admin
-- REMOVE   SSD-1TB        qty 1  Admin   reason: Sectores dañados (con nc_id)
-- INSTALL  SSD-2TB        qty 1  Admin

-- No conformes detectados con origen ASSET_REMOVAL
SELECT nc.folio, p.sku, a.asset_code, nc.reason, nc.nc_date
FROM non_conformities nc
JOIN products p ON p.product_id = nc.product_id
LEFT JOIN assets a ON a.asset_id = nc.asset_id
WHERE nc.nc_source = 'ASSET_REMOVAL'
ORDER BY nc.nc_date DESC;

-- Stock final de RAMs después de los movimientos
SELECT sku, name, quantity_on_hand
FROM v_inventory_current v
JOIN products p ON p.product_id = v.product_id
WHERE sku LIKE 'RAM%' OR sku LIKE 'SSD%'
ORDER BY sku;
-- Esperado:
-- RAM-DDR4-16GB: 4 inicial - 2 instalado + 2 retorno = 4 (vuelve a stock al hacer upgrade)
-- RAM-DDR4-32GB: 3 inicial - 2 instalado = 1
-- SSD-1TB:       2 inicial - 1 instalado - 1 NC OUT = 0
-- SSD-2TB:       2 inicial - 1 instalado = 1

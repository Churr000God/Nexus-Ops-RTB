-- =====================================================================
-- RTB · Seed inicial de Clientes y Proveedores
-- Ejemplos de migración: cliente con multi-RFC y multi-dirección,
-- proveedor recurrente con catálogo, proveedor ocasional.
-- =====================================================================
SET search_path = rtb, public;

-- ─────────────────────────────────────────────────────────────────────
-- 1) CLIENTE MULTI-SUCURSAL (3 razones sociales bajo un mismo "cliente")
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO customers (code, business_name, customer_type, locality, payment_terms_days, credit_limit, currency)
VALUES ('FEMSA', 'Grupo Femsa', 'COMPANY', 'LOCAL', 30, 5000000.00, 'MXN')
ON CONFLICT (code) DO NOTHING;

-- Tres RFCs (sucursales / razones sociales)
WITH c AS (SELECT customer_id FROM customers WHERE code = 'FEMSA')
INSERT INTO customer_tax_data (customer_id, rfc, legal_name, tax_regime_id, cfdi_use_id, zip_code, is_default)
SELECT c.customer_id, v.rfc, v.legal_name, v.regime, v.use, v.zip, v.is_def
FROM c, (VALUES
  ('FEM850412IT5', 'Femsa Comercial S.A. de C.V.',  601, 'G01', '64000', TRUE),
  ('CCF950101AB2', 'Coca-Cola Femsa S.A.B. de C.V.', 601, 'G01', '11800', FALSE),
  ('FEL010101XY7', 'Femsa Logística S.A. de C.V.',   601, 'G03', '64710', FALSE)
) AS v(rfc, legal_name, regime, use, zip, is_def);

-- Direcciones FISCAL (una por cada RFC) + Direcciones DELIVERY (sucursales)
WITH c AS (SELECT customer_id FROM customers WHERE code = 'FEMSA'),
     t AS (SELECT tax_data_id, rfc FROM customer_tax_data
           WHERE customer_id = (SELECT customer_id FROM customers WHERE code='FEMSA'))
-- FISCAL: una por cada RFC
INSERT INTO customer_addresses (customer_id, address_type, tax_data_id, label, street, exterior_number, neighborhood, city, state, zip_code, is_default)
SELECT c.customer_id, 'FISCAL', t.tax_data_id,
       'Domicilio fiscal ' || t.rfc,
       v.street, v.ext, v.neigh, v.city, v.state, v.zip, v.is_def
FROM c
JOIN t ON TRUE
JOIN (VALUES
  ('FEM850412IT5', 'Av. General Anaya', '601', 'Bella Vista', 'Monterrey', 'NL', '64000', TRUE),
  ('CCF950101AB2', 'Mario Pani',        '100', 'Santa Fe',    'CDMX',      'CDMX','11800', FALSE),
  ('FEL010101XY7', 'Carretera a Garcia', 'KM 5', 'Industrial', 'Apodaca',  'NL', '66600', FALSE)
) AS v(rfc, street, ext, neigh, city, state, zip, is_def)
  ON v.rfc = t.rfc;

-- DELIVERY: 3 sucursales de entrega (sin tax_data_id)
WITH c AS (SELECT customer_id FROM customers WHERE code = 'FEMSA')
INSERT INTO customer_addresses (customer_id, address_type, tax_data_id, label, street, exterior_number, neighborhood, city, state, zip_code, is_default)
SELECT c.customer_id, 'DELIVERY', NULL, v.label, v.street, v.ext, v.neigh, v.city, v.state, v.zip, v.is_def
FROM c, (VALUES
  ('Planta Vallejo',  'Calz. Vallejo',     '1500', 'Ind. Vallejo', 'CDMX',     'CDMX', '02300', TRUE),
  ('CEDIS Norte',     'Av. Industrial',    '450',  'Industrial',   'Monterrey','NL',   '66050', FALSE),
  ('CEDIS Bajío',     'Carr. León-Lagos',  'KM 3', 'Parque Ind.',  'León',     'GTO',  '37000', FALSE)
) AS v(label, street, ext, neigh, city, state, zip, is_def);

-- Contactos por rol
WITH c AS (SELECT customer_id FROM customers WHERE code = 'FEMSA')
INSERT INTO customer_contacts (customer_id, full_name, role_title, email, phone, is_primary)
SELECT c.customer_id, v.name, v.role, v.email, v.phone, v.prim
FROM c, (VALUES
  ('Juan Pérez Mtz.',   'Comprador',  'jperez@femsa.com',   '5511223344', TRUE),
  ('Ana Salazar',       'Tesorería',  'asalazar@femsa.com', '5512345678', FALSE),
  ('Roberto Castillo',  'Técnico',    'rcastillo@femsa.com','5598765432', FALSE)
) AS v(name, role, email, phone, prim);


-- ─────────────────────────────────────────────────────────────────────
-- 2) CLIENTE FORÁNEO SIMPLE
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO customers (code, business_name, customer_type, locality, payment_terms_days, currency)
VALUES ('AGRIM', 'Agrícola del Mayab', 'COMPANY', 'FOREIGN', 15, 'MXN')
ON CONFLICT (code) DO NOTHING;

WITH c AS (SELECT customer_id FROM customers WHERE code = 'AGRIM')
INSERT INTO customer_tax_data (customer_id, rfc, legal_name, tax_regime_id, cfdi_use_id, zip_code, is_default)
SELECT c.customer_id, 'AGM010101A12', 'Agrícola del Mayab S.A. de C.V.', 601, 'G01', '97000', TRUE FROM c;

WITH c AS (SELECT customer_id FROM customers WHERE code = 'AGRIM'),
     t AS (SELECT tax_data_id FROM customer_tax_data
           WHERE customer_id = (SELECT customer_id FROM customers WHERE code='AGRIM') LIMIT 1)
INSERT INTO customer_addresses (customer_id, address_type, tax_data_id, label, street, neighborhood, city, state, zip_code, is_default)
SELECT c.customer_id, 'FISCAL', t.tax_data_id,
       NULL, 'Calle 60 Norte', 'Centro', 'Mérida', 'YUC', '97000', TRUE
FROM c, t;


-- ─────────────────────────────────────────────────────────────────────
-- 3) PROVEEDOR RECURRENTE CON CATÁLOGO
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (code, business_name, supplier_type, locality, is_occasional, payment_terms_days, avg_payment_time_days, currency)
VALUES ('FESTO-MX', 'Festo México S.A. de C.V.', 'GOODS', 'LOCAL', FALSE, 30, 28, 'MXN')
ON CONFLICT (code) DO NOTHING;

WITH s AS (SELECT supplier_id FROM suppliers WHERE code = 'FESTO-MX')
INSERT INTO supplier_tax_data (supplier_id, rfc, legal_name, tax_regime_id, zip_code, is_default)
SELECT s.supplier_id, 'FME850101AB7', 'Festo México S.A. de C.V.', 601, '54940', TRUE FROM s;

WITH s AS (SELECT supplier_id FROM suppliers WHERE code = 'FESTO-MX'),
     t AS (SELECT tax_data_id FROM supplier_tax_data
           WHERE supplier_id = (SELECT supplier_id FROM suppliers WHERE code='FESTO-MX') LIMIT 1)
INSERT INTO supplier_addresses (supplier_id, address_type, tax_data_id, label, street, neighborhood, city, state, zip_code, is_default)
SELECT s.supplier_id, 'FISCAL', t.tax_data_id,
       NULL, 'Av. Ceylán', 'Industrial Vallejo', 'Tlalnepantla', 'EDOMEX', '54940', TRUE
FROM s, t;

WITH s AS (SELECT supplier_id FROM suppliers WHERE code = 'FESTO-MX')
INSERT INTO supplier_contacts (supplier_id, full_name, role_title, email, phone, is_primary)
SELECT s.supplier_id, 'Carlos Hernández', 'Asesor de cuenta', 'chernandez@festo.com.mx', '5550506060', TRUE FROM s;

-- Catálogo de productos del proveedor (asume que existen los products)
-- INSERT INTO supplier_products (supplier_id, product_id, supplier_sku, unit_cost, lead_time_days, moq, is_available, is_preferred)
-- SELECT s.supplier_id, p.product_id, 'DSBC-50-100-PPVA-N3', 2100, 14, 1, TRUE, TRUE
-- FROM suppliers s, products p
-- WHERE s.code = 'FESTO-MX' AND p.sku = 'CIL-FE-50';


-- ─────────────────────────────────────────────────────────────────────
-- 4) PROVEEDOR OCASIONAL
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (code, business_name, supplier_type, locality, is_occasional, payment_terms_days, currency, notes)
VALUES ('TEMP-001', 'Soldadura y Reparaciones del Centro', 'SERVICES', 'LOCAL', TRUE, 0, 'MXN',
        'Proveedor único para reparación urgente de tanque 2026-04-20.')
ON CONFLICT (code) DO NOTHING;

-- Datos fiscales mínimos
WITH s AS (SELECT supplier_id FROM suppliers WHERE code = 'TEMP-001')
INSERT INTO supplier_tax_data (supplier_id, rfc, legal_name, zip_code, is_default)
SELECT s.supplier_id, 'SRC900101XY8', 'Soldadura y Reparaciones del Centro S.A. de C.V.', '03100', TRUE FROM s;


-- ─────────────────────────────────────────────────────────────────────
-- 5) VALIDACIONES POST-SEED
-- ─────────────────────────────────────────────────────────────────────

-- Resumen de clientes con cuántos RFCs y direcciones tienen
SELECT
    c.code, c.business_name, c.locality,
    COUNT(DISTINCT ctd.tax_data_id) AS rfcs,
    COUNT(DISTINCT ca.address_id) FILTER (WHERE ca.address_type = 'FISCAL') AS direcciones_fiscales,
    COUNT(DISTINCT ca.address_id) FILTER (WHERE ca.address_type = 'DELIVERY') AS direcciones_delivery,
    COUNT(DISTINCT cc.contact_id) AS contactos
FROM customers c
LEFT JOIN customer_tax_data  ctd ON ctd.customer_id = c.customer_id
LEFT JOIN customer_addresses ca  ON ca.customer_id  = c.customer_id
LEFT JOIN customer_contacts  cc  ON cc.customer_id  = c.customer_id
GROUP BY c.code, c.business_name, c.locality
ORDER BY c.code;

-- Direcciones FISCAL con su RFC vinculado
SELECT
    c.code, ctd.rfc, ctd.legal_name,
    ca.street, ca.exterior_number, ca.city, ca.state, ca.zip_code
FROM customer_addresses ca
JOIN customer_tax_data ctd ON ctd.tax_data_id = ca.tax_data_id
JOIN customers c ON c.customer_id = ca.customer_id
WHERE ca.address_type = 'FISCAL'
ORDER BY c.code, ctd.rfc;

-- Proveedores ocasionales vs recurrentes
SELECT is_occasional, COUNT(*) FROM suppliers WHERE is_active GROUP BY is_occasional;

-- Verificar el CHECK constraint: ningún registro inválido
SELECT * FROM customer_addresses
WHERE (address_type = 'FISCAL' AND tax_data_id IS NULL)
   OR (address_type <> 'FISCAL' AND tax_data_id IS NOT NULL);
-- Debe regresar 0 filas

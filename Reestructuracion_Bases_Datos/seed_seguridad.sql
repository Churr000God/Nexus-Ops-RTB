-- =====================================================================
-- RTB · Seed inicial del módulo de Seguridad y Auditoría
-- Ejecutar UNA VEZ después de aplicar 03_schema.sql y 04_views_and_triggers.sql
-- =====================================================================
SET search_path = rtb, public;

-- ─────────────────────────────────────────────────────────────────────
-- 1) ROLES estándar
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO roles (code, name, description) VALUES
  ('ADMIN',      'Administrador', 'Acceso total al sistema'),
  ('SALES',      'Ventas',        'Cotizaciones, clientes, seguimiento de pedidos'),
  ('PURCHASING', 'Compras',       'Solicitudes de material, OCs, facturas de proveedor'),
  ('WAREHOUSE',  'Almacén',       'Recepciones, ajustes, no conformes, empacado'),
  ('ACCOUNTING', 'Contabilidad',  'CFDI, pagos, gastos operativos, conciliación')
ON CONFLICT (code) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 2) PERMISSIONS atómicos
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO permissions (code, description) VALUES
  -- Usuarios y roles
  ('user.view',                'Ver lista de usuarios'),
  ('user.manage',              'Crear, editar, desactivar usuarios'),
  ('role.manage',              'Crear roles y asignar permisos'),

  -- Clientes
  ('customer.view',            'Ver clientes y sus datos'),
  ('customer.manage',          'Crear, editar, desactivar clientes'),

  -- Proveedores
  ('supplier.view',            'Ver proveedores'),
  ('supplier.manage',          'Crear, editar, desactivar proveedores'),

  -- Productos
  ('product.view',             'Ver catálogo de productos'),
  ('product.manage',           'Crear, editar productos y configuraciones'),
  ('product.price.manage',     'Cambiar precios de venta del catálogo'),

  -- Ventas: cotizaciones
  ('quote.view',               'Ver cotizaciones'),
  ('quote.create',             'Crear cotizaciones nuevas'),
  ('quote.edit',               'Editar cotización en estado DRAFT'),
  ('quote.send',               'Enviar cotización al cliente (status SENT)'),
  ('quote.approve',            'Aprobar cotización (genera la orden)'),
  ('quote.cancel',             'Cancelar cotización'),

  -- Ventas: pedidos
  ('order.view',               'Ver pedidos'),
  ('order.pack',               'Empacar pedido (actualizar quantity_packed)'),
  ('order.ship',               'Marcar pedido como enviado'),
  ('order.deliver',            'Confirmar entrega'),
  ('order.cancel',             'Cancelar pedido'),

  -- Compras
  ('purchase_request.create',  'Crear solicitud de material'),
  ('purchase_request.approve', 'Aprobar solicitud de material'),
  ('purchase_order.create',    'Crear OC al proveedor'),
  ('purchase_order.send',      'Enviar OC'),
  ('purchase_order.cancel',    'Cancelar OC'),

  -- Almacén
  ('goods_receipt.create',     'Registrar entrada de mercancía'),
  ('goods_receipt.validate',   'Validar físicamente la mercancía recibida'),
  ('non_conformity.create',    'Levantar no conforme'),
  ('non_conformity.resolve',   'Resolver no conforme'),
  ('inventory.view',           'Consultar stock'),
  ('inventory.adjust',         'Ajuste manual de inventario'),

  -- Facturación / contabilidad
  ('supplier_invoice.capture', 'Capturar factura de proveedor'),
  ('supplier_invoice.pay',     'Marcar factura de proveedor como pagada'),
  ('cfdi.issue',               'Emitir CFDI tipo I al cliente'),
  ('cfdi.cancel',              'Cancelar CFDI ante el SAT'),
  ('cfdi.credit_note',         'Emitir nota de crédito (CFDI tipo E)'),
  ('payment.register',         'Registrar pago recibido del cliente'),
  ('expense.create',           'Capturar gasto operativo'),

  -- Reportes
  ('report.sales',             'Ver reporte de ventas'),
  ('report.inventory',         'Ver reporte de inventario y KPIs'),
  ('report.financial',         'Ver reportes financieros'),
  ('audit.view',               'Ver bitácora de auditoría')
ON CONFLICT (code) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 3) ROLE_PERMISSIONS — matriz rol × permisos
-- ─────────────────────────────────────────────────────────────────────

-- ADMIN: TODOS los permisos
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

-- SALES
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.code = 'SALES' AND p.code IN (
  'customer.view','customer.manage',
  'product.view','product.price.manage',
  'quote.view','quote.create','quote.edit','quote.send','quote.approve','quote.cancel',
  'order.view','order.cancel',
  'inventory.view',
  'report.sales','report.inventory'
)
ON CONFLICT DO NOTHING;

-- PURCHASING
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.code = 'PURCHASING' AND p.code IN (
  'supplier.view','supplier.manage',
  'product.view',
  'order.view',
  'purchase_request.create','purchase_request.approve',
  'purchase_order.create','purchase_order.send','purchase_order.cancel',
  'supplier_invoice.capture',
  'inventory.view',
  'report.inventory'
)
ON CONFLICT DO NOTHING;

-- WAREHOUSE
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.code = 'WAREHOUSE' AND p.code IN (
  'supplier.view',
  'product.view',
  'order.view','order.pack','order.ship','order.deliver',
  'purchase_request.create',
  'goods_receipt.create','goods_receipt.validate',
  'non_conformity.create','non_conformity.resolve',
  'inventory.view','inventory.adjust',
  'report.inventory'
)
ON CONFLICT DO NOTHING;

-- ACCOUNTING
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.code = 'ACCOUNTING' AND p.code IN (
  'customer.view',
  'supplier.view',
  'product.view',
  'quote.view',
  'order.view',
  'supplier_invoice.capture','supplier_invoice.pay',
  'cfdi.issue','cfdi.cancel','cfdi.credit_note',
  'payment.register',
  'expense.create',
  'inventory.view',
  'report.sales','report.inventory','report.financial'
)
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 4) USUARIO ADMIN INICIAL
-- ─────────────────────────────────────────────────────────────────────
-- IMPORTANTE: reemplazar el password_hash por uno generado con bcrypt cost >= 12.
-- Ejemplo en Node:  await bcrypt.hash('TuPasswordSeguro!', 12)
-- Ejemplo en Python: bcrypt.hashpw(b'TuPasswordSeguro!', bcrypt.gensalt(12))
-- El placeholder de abajo NO sirve para login — debe sustituirse antes de producción.

INSERT INTO users (email, full_name, password_hash, is_active)
VALUES (
  'admin@rtb.com',
  'Administrador RTB',
  '$2b$12$REEMPLAZAR_POR_HASH_BCRYPT_REAL_DE_60_CARACTERES_______',
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Asignar rol ADMIN al usuario admin
INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u, roles r
WHERE u.email = 'admin@rtb.com' AND r.code = 'ADMIN'
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 5) VALIDACIONES POST-INSTALACIÓN
-- ─────────────────────────────────────────────────────────────────────

-- ¿Cuántos permisos tiene cada rol?
SELECT r.code, COUNT(rp.permission_id) AS num_permisos
FROM roles r
LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
GROUP BY r.code
ORDER BY r.code;

-- ¿Cuántos roles tiene cada usuario?
SELECT u.email, u.is_active, COUNT(ur.role_id) AS num_roles,
       STRING_AGG(r.code, ', ') AS roles
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.user_id
LEFT JOIN roles r       ON r.role_id  = ur.role_id
GROUP BY u.email, u.is_active
ORDER BY u.email;

-- ¿Algún permiso sin asignar a ningún rol?
SELECT p.code AS permiso_huerfano
FROM permissions p
LEFT JOIN role_permissions rp ON rp.permission_id = p.permission_id
WHERE rp.permission_id IS NULL;

-- ¿Existe al menos un usuario ADMIN activo?
SELECT COUNT(*) AS admins_activos
FROM users u
JOIN user_roles ur ON ur.user_id = u.user_id
JOIN roles r       ON r.role_id  = ur.role_id
WHERE r.code = 'ADMIN' AND u.is_active = TRUE;
-- Debe ser >= 1

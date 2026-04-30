-- =====================================================================
-- RTB · Seed de Ventas y Logística
-- Ejemplo extremo a extremo: NRs → Cotización formal → Pedido →
-- Empacado → Envío con tracking → Ruta → Entrega → CFDI → Pagos
-- =====================================================================
SET search_path = rtb, public;

-- ─────────────────────────────────────────────────────────────────────
-- 0) FLETERAS
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO carriers (code, name, contact_name, phone, email, tracking_url_template, is_internal) VALUES
  ('INTERNA-1', 'Camioneta RTB Norte', 'Carlos Reyes', '5599887766', NULL, NULL, TRUE),
  ('INTERNA-2', 'Camioneta RTB Sur',   'Luis Gómez',   '5599887700', NULL, NULL, TRUE),
  ('FEDEX',     'FedEx México',        'Atención',     '8001234567', 'cs@fedex.com.mx',
                'https://fedex.com.mx/track?n={tracking}', FALSE),
  ('DHL',       'DHL Express',         NULL,           NULL,         NULL,
                'https://dhl.com/track?n={tracking}', FALSE)
ON CONFLICT (code) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 1) DOS NOTAS DE REMISIÓN (entrega informal a Femsa)
--    Asume que existen el cliente FEMSA, sus direcciones, y productos.
-- ─────────────────────────────────────────────────────────────────────

-- NR-001: 3 productos entregados a Planta Vallejo
INSERT INTO delivery_notes (note_number, customer_id, shipping_address_id, sales_rep_id,
                            issue_date, delivery_date, status, subtotal, tax_amount, total)
SELECT 'NR-2026-001', c.customer_id,
       (SELECT address_id FROM customer_addresses
        WHERE customer_id = c.customer_id AND label = 'Planta Vallejo'),
       (SELECT user_id FROM users WHERE email = 'admin@rtb.com'),
       '2026-04-01', '2026-04-02', 'DELIVERED',
       45000, 7200, 52200
FROM customers c WHERE c.code = 'FEMSA';

-- NR-002: 2 productos entregados a Planta Vallejo
INSERT INTO delivery_notes (note_number, customer_id, shipping_address_id, sales_rep_id,
                            issue_date, delivery_date, status, subtotal, tax_amount, total)
SELECT 'NR-2026-002', c.customer_id,
       (SELECT address_id FROM customer_addresses
        WHERE customer_id = c.customer_id AND label = 'Planta Vallejo'),
       (SELECT user_id FROM users WHERE email = 'admin@rtb.com'),
       '2026-04-05', '2026-04-06', 'DELIVERED',
       30000, 4800, 34800
FROM customers c WHERE c.code = 'FEMSA';


-- ─────────────────────────────────────────────────────────────────────
-- 2) CUANDO LLEGA LA OC FORMAL DEL CLIENTE: SE CREA UNA COTIZACIÓN
--    QUE CONSOLIDA LAS DOS NRs
-- ─────────────────────────────────────────────────────────────────────

-- Capturar la OC del cliente en las NR
UPDATE delivery_notes
   SET customer_po_number = 'PO-FEMSA-2026-1234',
       customer_po_date   = '2026-04-15'
 WHERE note_number IN ('NR-2026-001','NR-2026-002');

-- Crear cotización formal que cubre ambas NRs
INSERT INTO quotes (quote_number, customer_id, customer_address_id, sales_rep_id,
                    status, issue_date, approval_date, currency, payment_terms_days)
SELECT 'COT-2026-100', c.customer_id,
       (SELECT address_id FROM customer_addresses WHERE customer_id = c.customer_id AND label = 'Planta Vallejo'),
       (SELECT user_id FROM users WHERE email = 'admin@rtb.com'),
       'APPROVED', '2026-04-15', '2026-04-15', 'MXN', 30
FROM customers c WHERE c.code = 'FEMSA';

-- Asociar la cotización con las DOS NRs (consolidación N:N)
INSERT INTO quote_delivery_notes (quote_id, delivery_note_id, associated_by, notes)
SELECT q.quote_id, dn.delivery_note_id,
       (SELECT user_id FROM users WHERE email = 'admin@rtb.com'),
       'Consolidación: la OC del cliente cubre ambas NRs'
FROM quotes q, delivery_notes dn
WHERE q.quote_number = 'COT-2026-100'
  AND dn.note_number IN ('NR-2026-001','NR-2026-002');

-- Marcar las NRs como TRANSFORMED (asociadas a quote)
UPDATE delivery_notes
   SET status = 'TRANSFORMED'
 WHERE note_number IN ('NR-2026-001','NR-2026-002');


-- ─────────────────────────────────────────────────────────────────────
-- 3) PEDIDO Y ENVÍO (asume que el trigger ya generó el order al APPROVED)
-- ─────────────────────────────────────────────────────────────────────

-- Crear shipment para el pedido
INSERT INTO shipments (shipment_number, order_id, customer_address_id, carrier_id,
                       tracking_number, status, shipping_cost, shipping_date, estimated_arrival)
SELECT 'SHP-2026-050', o.order_id, o.shipping_address_id,
       (SELECT carrier_id FROM carriers WHERE code = 'INTERNA-1'),
       'INT-RTB-050', 'IN_TRANSIT',
       1500, '2026-04-16 09:00', '2026-04-16 14:00'
FROM orders o
JOIN quotes q ON q.quote_id = o.quote_id
WHERE q.quote_number = 'COT-2026-100';


-- Eventos de tracking
INSERT INTO shipment_tracking_events (shipment_id, event_date, location, status_code, description, source)
SELECT s.shipment_id, e.event_date, e.location, e.code, e.desc, 'MANUAL'
FROM shipments s, (VALUES
  ('2026-04-16 08:30'::TIMESTAMPTZ, 'Almacén RTB',   'PICKED_UP',  'Material recolectado'),
  ('2026-04-16 11:00'::TIMESTAMPTZ, 'Periférico',    'IN_TRANSIT', 'En camino'),
  ('2026-04-16 13:45'::TIMESTAMPTZ, 'Vallejo',       'ARRIVED',    'Llegó al destino'),
  ('2026-04-16 14:10'::TIMESTAMPTZ, 'Planta Vallejo','DELIVERED',  'Entregado a Juan Pérez (firmó)')
) AS e(event_date, location, code, "desc")
WHERE s.shipment_number = 'SHP-2026-050';

-- Marcar shipment como entregado (dispara trigger fn_on_shipment_delivered)
UPDATE shipments
   SET status = 'DELIVERED', actual_arrival = '2026-04-16 14:10', received_by_name = 'Juan Pérez'
 WHERE shipment_number = 'SHP-2026-050';


-- ─────────────────────────────────────────────────────────────────────
-- 4) RUTA: una ruta con varias paradas (entregas + recolecciones)
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO routes (route_number, route_date, driver_user_id, vehicle_label, status)
SELECT 'RT-2026-04-16', '2026-04-16',
       (SELECT user_id FROM users WHERE email = 'admin@rtb.com'),
       'Camioneta 1', 'COMPLETED';

-- Paradas (asumiendo que existe SHP-2026-050)
INSERT INTO route_stops (route_id, stop_order, stop_type, customer_address_id, shipment_id,
                         estimated_arrival, actual_arrival, status)
SELECT r.route_id, 1, 'DELIVERY', s.customer_address_id, s.shipment_id,
       '2026-04-16 14:00', '2026-04-16 14:10', 'COMPLETED'
FROM routes r, shipments s
WHERE r.route_number = 'RT-2026-04-16'
  AND s.shipment_number = 'SHP-2026-050';

-- Si quieres una parada PICKUP, descomentar y referencias a una OC existente:
-- INSERT INTO route_stops (route_id, stop_order, stop_type, supplier_address_id, purchase_order_id,
--                          estimated_arrival, status)
-- SELECT r.route_id, 2, 'PICKUP',
--        (SELECT address_id FROM supplier_addresses WHERE supplier_id =
--           (SELECT supplier_id FROM suppliers WHERE code='FESTO-MX') LIMIT 1),
--        po.po_id, '2026-04-16 16:00', 'PENDING'
-- FROM routes r, purchase_orders po
-- WHERE r.route_number = 'RT-2026-04-16' AND po.po_number = 'PO-2026-001';


-- ─────────────────────────────────────────────────────────────────────
-- 5) PAGOS PARCIALES
-- ─────────────────────────────────────────────────────────────────────

-- Primer pago parcial (50%)
INSERT INTO payments (payment_number, customer_id, payment_date, payment_form_id, bank_reference, amount)
SELECT 'PAY-2026-100', c.customer_id, '2026-04-30', '03', 'TRANSF-456789', 50000
FROM customers c WHERE c.code = 'FEMSA';

-- Aplicar a la orden
INSERT INTO payment_applications (payment_id, order_id, amount_applied)
SELECT p.payment_id, o.order_id, 50000
FROM payments p, orders o
JOIN quotes q ON q.quote_id = o.quote_id
WHERE p.payment_number = 'PAY-2026-100' AND q.quote_number = 'COT-2026-100';

-- Segundo pago parcial (resto)
INSERT INTO payments (payment_number, customer_id, payment_date, payment_form_id, bank_reference, amount)
SELECT 'PAY-2026-101', c.customer_id, '2026-05-15', '03', 'TRANSF-456790', 37000
FROM customers c WHERE c.code = 'FEMSA';

INSERT INTO payment_applications (payment_id, order_id, amount_applied)
SELECT p.payment_id, o.order_id, 37000
FROM payments p, orders o
JOIN quotes q ON q.quote_id = o.quote_id
WHERE p.payment_number = 'PAY-2026-101' AND q.quote_number = 'COT-2026-100';


-- ─────────────────────────────────────────────────────────────────────
-- 6) CFDI CANCELADO Y REEXPEDIDO (ejemplo)
-- ─────────────────────────────────────────────────────────────────────

-- Imaginemos que ya emitiste un CFDI 'CFDI-A' con error en el RFC del cliente.
-- Primero generaste el CFDI de reemplazo 'CFDI-B' con datos correctos.
-- Luego cancelas el original con motivo '01' (errores con relación).

-- Suponiendo que existen CFDI-A (cfdi_id=1) y CFDI-B (cfdi_id=2):
-- UPDATE cfdi SET replaces_cfdi_id = 1 WHERE cfdi_id = 2;
-- UPDATE cfdi SET status='CANCELLED', cancelled_at=now(),
--                 cancellation_reason='Error en RFC del receptor',
--                 sat_cancellation_motive='01',
--                 sat_cancellation_uuid_substitute=(SELECT uuid FROM cfdi WHERE cfdi_id=2),
--                 replaced_by_cfdi_id=2
-- WHERE cfdi_id = 1;


-- ─────────────────────────────────────────────────────────────────────
-- 7) VALIDACIONES
-- ─────────────────────────────────────────────────────────────────────

-- Avance de empacado
SELECT * FROM v_order_packing_progress;

-- Estado de pago consolidado
SELECT * FROM v_order_payment_status WHERE customer = 'Grupo Femsa';

-- Pedidos incompletos
SELECT * FROM v_orders_incomplete_tracking WHERE qty_pending_to_ship > 0;

-- Resumen de envíos con tracking
SELECT * FROM v_shipments_overview;

-- Historial de cancelaciones de CFDI
SELECT * FROM v_cfdi_cancellations;

-- Notas de remisión y a qué cotización fueron transformadas
SELECT dn.note_number, dn.status, q.quote_number, q.status AS quote_status
FROM delivery_notes dn
LEFT JOIN quote_delivery_notes qdn ON qdn.delivery_note_id = dn.delivery_note_id
LEFT JOIN quotes q ON q.quote_id = qdn.quote_id
ORDER BY dn.note_number;

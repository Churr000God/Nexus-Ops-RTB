-- =====================================================================
-- RTB · Seed de Compras
-- Ejemplo extremo a extremo: PR mixto (RESALE + INTERNAL + SERVICE)
-- → PO → GR (solo GOODS) → factura con códigos SAT → pago
-- + ejemplo de gasto operativo
-- =====================================================================
SET search_path = rtb, public;

-- ─────────────────────────────────────────────────────────────────────
-- 0) Catálogos SAT mínimos (en producción se cargan completos del SAT)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO sat_payment_forms (form_id, description) VALUES
  ('01','Efectivo'),
  ('02','Cheque nominativo'),
  ('03','Transferencia electrónica de fondos'),
  ('04','Tarjeta de crédito'),
  ('05','Monedero electrónico'),
  ('06','Dinero electrónico'),
  ('28','Tarjeta de débito'),
  ('99','Por definir')
ON CONFLICT (form_id) DO NOTHING;

INSERT INTO sat_payment_methods (method_id, description) VALUES
  ('PUE','Pago en una sola exhibición'),
  ('PPD','Pago en parcialidades o diferido')
ON CONFLICT (method_id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 1) PURCHASE REQUEST con tres tipos de items
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO purchase_requests (request_number, requested_by, request_date, status, notes)
SELECT 'PR-2026-100',
       (SELECT user_id FROM users WHERE email = 'admin@rtb.com'),
       '2026-04-10', 'APPROVED',
       'Compra mixta: cilindros para venta + tóner oficina + mantenimiento prensa';

-- 3 partidas con item_type distinto
INSERT INTO purchase_request_items (
    request_id, line_number, item_type, product_id, service_description,
    unit_of_measure, quantity_requested, suggested_supplier_id
)
SELECT
    pr.request_id, v.line, v.itype,
    v.product_id, v.svc_desc, v.unit, v.qty,
    (SELECT supplier_id FROM suppliers WHERE code = 'FESTO-MX')
FROM purchase_requests pr,
LATERAL (VALUES
    (1::SMALLINT, 'GOODS_RESALE',  (SELECT product_id FROM products WHERE sku='CMP-XS200'),
        NULL::TEXT,  'pieza',  10::NUMERIC),
    (2::SMALLINT, 'GOODS_INTERNAL', (SELECT product_id FROM products WHERE sku='RFC-O-RING-25'),
        NULL::TEXT, 'pieza', 50::NUMERIC),
    (3::SMALLINT, 'SERVICE', NULL::BIGINT,
        'Mantenimiento preventivo prensa hidráulica modelo Z-50',
        'visita', 1::NUMERIC)
) AS v(line, itype, product_id, svc_desc, unit, qty)
WHERE pr.request_number = 'PR-2026-100';


-- ─────────────────────────────────────────────────────────────────────
-- 2) PURCHASE ORDER mixta al proveedor (Festo en este ejemplo)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO purchase_orders (
    po_number, supplier_id, po_type, status,
    issue_date, estimated_pickup_date, currency, exchange_rate
)
SELECT 'PO-2026-200',
       (SELECT supplier_id FROM suppliers WHERE code = 'FESTO-MX'),
       'MIXED', 'CONFIRMED',
       '2026-04-12', '2026-04-15', 'MXN', 1;

-- 3 partidas vinculadas a sus PR-items
INSERT INTO purchase_order_items (
    po_id, line_number, request_item_id, product_id, item_type,
    service_description, unit_of_measure, quantity_ordered, unit_cost, tax_pct
)
SELECT po.po_id, pri.line_number, pri.request_item_id, pri.product_id, pri.item_type,
       pri.service_description, pri.unit_of_measure, pri.quantity_requested,
       v.cost, 16
FROM purchase_orders po
JOIN purchase_requests pr ON pr.request_number = 'PR-2026-100'
JOIN purchase_request_items pri ON pri.request_id = pr.request_id
JOIN (VALUES
    (1::SMALLINT, 2100.00),
    (2::SMALLINT, 250.00),
    (3::SMALLINT, 5000.00)
) AS v(line_number, cost) ON v.line_number = pri.line_number
WHERE po.po_number = 'PO-2026-200';


-- ─────────────────────────────────────────────────────────────────────
-- 3) GOODS RECEIPT (solo de los items GOODS, no servicios)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO goods_receipts (
    receipt_number, po_id, supplier_id, receipt_date,
    physical_validation, validated_by, delivery_pct
)
SELECT 'GR-2026-300',
       po.po_id,
       po.supplier_id,
       '2026-04-15', TRUE,
       (SELECT user_id FROM users WHERE email = 'admin@rtb.com'),
       100
FROM purchase_orders po WHERE po.po_number = 'PO-2026-200';

-- Recibimos los 2 items GOODS (no el SERVICE)
INSERT INTO goods_receipt_items (
    receipt_id, po_item_id, line_number, product_id,
    quantity_requested, quantity_received, unit_cost
)
SELECT gr.receipt_id, poi.po_item_id, poi.line_number, poi.product_id,
       poi.quantity_ordered, poi.quantity_ordered, poi.unit_cost
FROM goods_receipts gr
JOIN purchase_orders po ON po.po_id = gr.po_id
JOIN purchase_order_items poi ON poi.po_id = po.po_id
WHERE gr.receipt_number = 'GR-2026-300'
  AND poi.item_type IN ('GOODS_RESALE','GOODS_INTERNAL');
-- Trigger fn_create_inv_movement_from_receipt creará 2 movements RECEIPT
-- Trigger fn_recalc_product_avg_cost recalculará current_avg_cost


-- ─────────────────────────────────────────────────────────────────────
-- 4) SUPPLIER INVOICE (cubre todos los items: bienes + servicio)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO supplier_invoices (
    supplier_id, invoice_number, invoice_type, invoice_date, receipt_date,
    payment_due_date, sat_payment_form_id, sat_payment_method_id,
    currency, subtotal, tax_amount, total,
    status, payment_status,
    notes
)
SELECT po.supplier_id, 'A-12345', 'MIXED',
       '2026-04-20', '2026-04-22', '2026-05-22',
       '03',     -- forma SAT: Transferencia
       'PPD',    -- método SAT: a crédito
       'MXN',
       (10*2100 + 50*250 + 1*5000),  -- subtotal: 38,500
       (10*2100 + 50*250 + 1*5000) * 0.16,  -- IVA 16%: 6,160
       (10*2100 + 50*250 + 1*5000) * 1.16,  -- total: 44,660
       'RECEIVED', 'UNPAID',
       'Factura mixta: cilindros + tóner + mantenimiento'
FROM purchase_orders po WHERE po.po_number = 'PO-2026-200';
-- is_credit = TRUE (computed: PPD)

-- Items de la factura — incluye el servicio
INSERT INTO supplier_invoice_items (
    invoice_id, po_item_id, line_number, product_id, item_type,
    concept_description, quantity, unit_cost,
    tax_pct, subtotal, tax_amount, total
)
SELECT si.invoice_id, poi.po_item_id, poi.line_number,
       poi.product_id, poi.item_type,
       poi.service_description,
       poi.quantity_ordered, poi.unit_cost,
       16,
       poi.quantity_ordered * poi.unit_cost,
       poi.quantity_ordered * poi.unit_cost * 0.16,
       poi.quantity_ordered * poi.unit_cost * 1.16
FROM supplier_invoices si
JOIN purchase_orders po ON po.po_number = 'PO-2026-200'
JOIN purchase_order_items poi ON poi.po_id = po.po_id
WHERE si.invoice_number = 'A-12345';

-- Vincular goods_receipt con supplier_invoice
UPDATE goods_receipts SET supplier_invoice_id = (SELECT invoice_id FROM supplier_invoices WHERE invoice_number = 'A-12345')
WHERE receipt_number = 'GR-2026-300';


-- ─────────────────────────────────────────────────────────────────────
-- 5) PAGO de la factura (trigger valida cadena estricta)
-- ─────────────────────────────────────────────────────────────────────
-- Si intentamos PAID sin GR, fallaría. Como ya hay GR vinculado, pasa.
UPDATE supplier_invoices
   SET payment_status = 'PAID',
       payment_date = '2026-05-22',
       status = 'PAID'
 WHERE invoice_number = 'A-12345';


-- ─────────────────────────────────────────────────────────────────────
-- 6) GASTO OPERATIVO (flujo independiente, sin PR/PO)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO operating_expenses (
    expense_number, supplier_rfc, concept, category, expense_date,
    invoice_folio, uuid_sat,
    is_deductible, sat_payment_form_id, sat_payment_method_id, status,
    responsible_user_id, subtotal, tax_amount, total, notes
) VALUES (
    'GO-2026-150', 'CFE850101AB7', 'Energía eléctrica abril 2026', 'Servicios',
    '2026-04-30', 'CFE-12345', 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
    TRUE, '03', 'PUE', 'PAID',
    (SELECT user_id FROM users WHERE email = 'admin@rtb.com'),
    8500, 1360, 9860,
    'Pago de luz oficina central'
);


-- ─────────────────────────────────────────────────────────────────────
-- 7) VALIDACIONES
-- ─────────────────────────────────────────────────────────────────────

-- Cadena completa de la PR-2026-100 (debe mostrar 3 renglones)
SELECT * FROM v_purchase_chain WHERE request_number = 'PR-2026-100';

-- Aging de facturas pendientes
SELECT * FROM v_supplier_invoices_aging WHERE payment_status <> 'PAID';

-- Productos con costo actualizado por las recepciones
SELECT p.sku, p.current_avg_cost, p.current_avg_cost_updated_at
FROM products p
WHERE p.product_id IN (
    (SELECT product_id FROM products WHERE sku = 'CMP-XS200'),
    (SELECT product_id FROM products WHERE sku = 'RFC-O-RING-25')
);

-- Histórico de cambios de costo
SELECT p.sku, h.previous_avg_cost, h.new_avg_cost, h.triggered_by, h.recorded_at
FROM product_cost_history h
JOIN products p ON p.product_id = h.product_id
ORDER BY h.recorded_at DESC LIMIT 5;

-- Gastos operativos por categoría (mes actual)
SELECT category, COUNT(*) AS cantidad, SUM(total) AS total
FROM operating_expenses
WHERE expense_date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY category;

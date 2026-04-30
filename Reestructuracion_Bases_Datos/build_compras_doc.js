const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, Header, Footer, PageBreak
} = require('docx');
const ARIAL = "Arial", DARK = "1F2937", GRAY = "6B7280", CODEBG = "F3F4F6";
const heading = (t, l) => new Paragraph({ heading: l, children: [new TextRun({ text: t, font: ARIAL })] });
const h1 = t => heading(t, HeadingLevel.HEADING_1);
const h2 = t => heading(t, HeadingLevel.HEADING_2);
const h3 = t => heading(t, HeadingLevel.HEADING_3);
const p = (t, o={}) => new Paragraph({ children: [new TextRun({ text: t, font: ARIAL, ...o })], spacing: { after: 120 } });
const pBold = t => p(t, { bold: true });
const pItalic = t => p(t, { italics: true });
const code = txt => {
  const lines = txt.split('\n');
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: CODEBG },
    spacing: { before: 120, after: 120 },
    children: lines.flatMap((line, i) => {
      const r = [new TextRun({ text: line || ' ', font: "Courier New", size: 18 })];
      if (i < lines.length - 1) r.push(new TextRun({ break: 1 }));
      return r;
    })
  });
};
const bullet = t => new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: t, font: ARIAL })] });
const numList = t => new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: t, font: ARIAL })] });
const border = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
function makeTable(rows, widths) {
  const total = widths.reduce((a,b) => a+b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((row, idx) => new TableRow({
      tableHeader: idx === 0,
      children: row.map((cell, ci) => new TableCell({
        borders, width: { size: widths[ci], type: WidthType.DXA },
        shading: idx === 0 ? { fill: DARK, type: ShadingType.CLEAR } : undefined,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({ text: String(cell), font: ARIAL, size: 20, bold: idx === 0,
            color: idx === 0 ? "FFFFFF" : DARK })]
        })]
      }))
    }))
  });
}
const ch = [];

// Portada
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 240 },
  children: [new TextRun({ text: "Módulo de Compras", font: ARIAL, size: 56, bold: true })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360, after: 120 },
  children: [new TextRun({ text: "Sistema RTB · PostgreSQL", font: ARIAL, size: 28, color: GRAY })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "Solicitudes · OCs · Recepciones · Facturas · Pagos · Servicios · Gastos", font: ARIAL, size: 18, color: GRAY })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 },
  children: [new TextRun({ text: "Documento de diseño y operación · v1.0", font: ARIAL, size: 22, color: GRAY })] }));
ch.push(new Paragraph({ children: [new PageBreak()] }));

// 1. INTRO
ch.push(h1("1. Introducción"));
ch.push(p("Este documento describe el módulo de Compras del sistema RTB. Cubre toda la cadena de adquisiciones desde la detección de necesidad hasta el pago al proveedor, incluyendo el manejo de servicios y gastos operativos."));

ch.push(h2("1.1 Regla de oro: cadena estricta"));
ch.push(pBold("Ningún pago a proveedor se autoriza sin la cadena completa de documentos."));
ch.push(code(
`purchase_request → purchase_order → goods_receipt → supplier_invoice → payment

Para servicios:
purchase_request (item_type=SERVICE) → purchase_order → supplier_invoice → payment
                                                       (sin goods_receipt)

Para gastos operativos:
operating_expenses (flujo independiente, sin PR/PO)`));

ch.push(p("Esta cadena se valida con triggers fn_validate_invoice_chain y fn_validate_po_has_request."));

ch.push(h2("1.2 Cuatro destinos de la compra"));
ch.push(makeTable([
  ["Tipo (item_type)","Para qué","Genera goods_receipt","Afecta inventario"],
  ["GOODS_RESALE","Productos para venta a clientes","Sí","Sí (RECEIPT)"],
  ["GOODS_INTERNAL","Material de uso interno","Sí","Sí (RECEIPT)"],
  ["SERVICE","Servicios contratados","No","No"],
  ["operating_expenses","Gastos operativos no inventariables","N/A","No"]
], [2400, 3000, 1800, 2160]));

ch.push(p("Los tres primeros pasan por la cadena PR → PO → ... ; los gastos operativos se capturan directamente."));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 2. SOLICITUDES DE MATERIAL
ch.push(h1("2. Solicitudes de material (purchase_requests)"));
ch.push(p("Es el documento que genera operación o ventas: \"necesito X cantidad de tal SKU para tal proyecto\". El comprador toma estas solicitudes y arma OCs con sus proveedores."));

ch.push(h2("2.1 purchase_requests (cabecera)"));
ch.push(code(
`CREATE TABLE purchase_requests (
    request_id      BIGINT PK,
    request_number  TEXT UNIQUE,
    requested_by    BIGINT FK users,        -- quién solicita
    request_date    DATE NOT NULL,
    status          TEXT (DRAFT,APPROVED,PARTIALLY_ORDERED,ORDERED,REJECTED,CANCELLED),
    notes           TEXT
);`));

ch.push(h2("2.2 purchase_request_items (detalle)"));
ch.push(code(
`CREATE TABLE purchase_request_items (
    request_item_id   BIGINT PK,
    request_id        BIGINT FK,
    line_number       SMALLINT,
    product_id        BIGINT FK products,           -- nullable si es SERVICE
    item_type         TEXT (GOODS_RESALE | GOODS_INTERNAL | SERVICE),
    service_description TEXT,                       -- requerido si SERVICE
    unit_of_measure   TEXT,                         -- 'pieza', 'hora', 'visita'
    quantity_requested        NUMERIC,
    quantity_after_conversion NUMERIC,              -- TDP
    quantity_ordered  NUMERIC,                      -- cuánto ya está en alguna PO
    suggested_supplier_id BIGINT FK suppliers,
    quote_item_id     BIGINT FK quote_items,        -- qué quote la originó (si aplica)
    in_package        BOOLEAN,
    exception_reason  TEXT
);`));

ch.push(p("CHECK constraint chk_pri_product_or_service garantiza:"));
ch.push(bullet("Si item_type es GOODS_*, product_id es obligatorio."));
ch.push(bullet("Si item_type es SERVICE, service_description es obligatorio (product_id NULL)."));

ch.push(h2("2.3 Ejemplo: PR con tres tipos en la misma solicitud"));
ch.push(makeTable([
  ["line","item_type","product / descripción","quantity"],
  ["1","GOODS_RESALE","SKU CIL-FE-50 (cilindro Festo)","10"],
  ["2","GOODS_INTERNAL","SKU TON-LIMP (toner impresora)","2"],
  ["3","SERVICE","Mantenimiento preventivo equipo X","1 visita"]
], [800, 1700, 4500, 2360]));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 3. ÓRDENES DE COMPRA
ch.push(h1("3. Órdenes de compra (purchase_orders)"));

ch.push(h2("3.1 purchase_orders (cabecera)"));
ch.push(code(
`CREATE TABLE purchase_orders (
    po_id              BIGINT PK,
    po_number          TEXT UNIQUE,             -- folio
    supplier_id        BIGINT FK,
    po_type            TEXT (GOODS|SERVICES|MIXED),
    status             TEXT (DRAFT,SENT,CONFIRMED,PARTIAL_RECEIVED,RECEIVED,INVOICED,PAID,CANCELLED),
    collection_status  TEXT,                    -- estado de recolección
    issue_date, sent_date, confirmation_date,
    estimated_pickup_date, pickup_date,
    is_confirmed, is_email_sent, is_printed,
    follow_up_user_id  BIGINT FK,
    currency, exchange_rate,
    subtotal, tax_amount, shipping_amount, total
);`));

ch.push(h2("3.2 Tipos de PO"));
ch.push(makeTable([
  ["po_type","Cuándo","Genera GR","Validación"],
  ["GOODS","100% bienes","Sí","trg_validate_po_request: requiere PR vinculada para confirmar"],
  ["SERVICES","100% servicios","No","No requiere PR (puede originarse directo)"],
  ["MIXED","Bienes + servicios","Solo para items GOODS_*","Mixto"]
], [1500, 2500, 1800, 3560]));

ch.push(h2("3.3 purchase_order_items"));
ch.push(p("Mismo modelo que purchase_request_items: item_type + product_id o service_description según corresponda. Vincula opcional a request_item_id (la PR que la originó)."));

ch.push(h2("3.4 Función de la PO en el negocio"));
ch.push(bullet("Seguimiento de costos: snapshot del unit_cost al momento de comprar."));
ch.push(bullet("Control de existencias: la PO confirmada se usa en planeación de inventario futuro."));
ch.push(bullet("Programación de recolección: estimated_pickup_date + pickup_date alimentan la planeación de rutas."));
ch.push(bullet("Registro fiscal: la PO es la base que justifica la factura del proveedor."));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 4. RECEPCIONES
ch.push(h1("4. Recepciones de mercancía (goods_receipts)"));

ch.push(h2("4.1 Cambio crítico: po_id ahora es NOT NULL"));
ch.push(p("Por la regla de cadena estricta:"));
ch.push(code(
`ALTER TABLE goods_receipts     ALTER COLUMN po_id      SET NOT NULL;
ALTER TABLE goods_receipt_items ALTER COLUMN po_item_id SET NOT NULL;`));
ch.push(p("Toda entrada de mercancía DEBE tener PO. Sin excepción para flujos GOODS."));

ch.push(h2("4.2 Estructura"));
ch.push(code(
`CREATE TABLE goods_receipts (
    receipt_id          BIGINT PK,
    receipt_number      TEXT UNIQUE,
    po_id               BIGINT NOT NULL FK,           -- ahora obligatorio
    supplier_invoice_id BIGINT FK (puede llegar después),
    supplier_id         BIGINT NOT NULL FK,
    receipt_date        DATE,
    physical_validation BOOLEAN,
    validated_by        BIGINT FK users,
    validated_at        TIMESTAMPTZ,
    delivery_pct        NUMERIC,
    notes               TEXT
);

CREATE TABLE goods_receipt_items (
    receipt_item_id     BIGINT PK,
    receipt_id          BIGINT FK,
    po_item_id          BIGINT NOT NULL FK,           -- obligatorio
    invoice_item_id     BIGINT FK (opcional)
    line_number, product_id, quantity_requested, quantity_received,
    quantity_after_conversion, unit_cost, notes
);`));

ch.push(h2("4.3 Trigger automático"));
ch.push(p("Al insertar un goods_receipt_item, fn_create_inv_movement_from_receipt crea automáticamente un inventory_movement tipo RECEIPT (sube el stock) y dispara fn_recalc_product_avg_cost (recalcula el promedio móvil)."));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 5. FACTURAS DE PROVEEDOR
ch.push(h1("5. Facturas del proveedor (supplier_invoices)"));

ch.push(h2("5.1 Estructura ampliada con códigos SAT"));
ch.push(code(
`-- Campos agregados:
ALTER TABLE supplier_invoices
  ADD COLUMN invoice_type TEXT NOT NULL DEFAULT 'GOODS'
    CHECK (invoice_type IN ('GOODS','SERVICES','MIXED')),
  ADD COLUMN sat_payment_form_id   TEXT FK sat_payment_forms,
  ADD COLUMN sat_payment_method_id TEXT FK sat_payment_methods,
  ADD COLUMN is_credit BOOLEAN GENERATED ALWAYS AS (sat_payment_method_id = 'PPD') STORED;`));

ch.push(h2("5.2 Códigos SAT relevantes"));
ch.push(pBold("sat_payment_forms (forma de pago — c_FormaPago):"));
ch.push(makeTable([
  ["Código","Significado"],
  ["01","Efectivo"],
  ["02","Cheque nominativo"],
  ["03","Transferencia electrónica de fondos"],
  ["04","Tarjeta de crédito"],
  ["05","Monedero electrónico"],
  ["06","Dinero electrónico"],
  ["28","Tarjeta de débito"],
  ["99","Por definir"]
], [1500, 7860]));

ch.push(pBold("sat_payment_methods (método de pago):"));
ch.push(makeTable([
  ["Código","Significado","is_credit"],
  ["PUE","Pago en Una Exhibición (contado)","false"],
  ["PPD","Pago en Parcialidades o Diferido (crédito)","true"]
], [1500, 5860, 2000]));

ch.push(h2("5.3 supplier_invoice_items con servicios"));
ch.push(code(
`-- Campos agregados:
ALTER TABLE supplier_invoice_items
  ALTER COLUMN product_id DROP NOT NULL,
  ADD COLUMN item_type TEXT NOT NULL DEFAULT 'GOODS_RESALE',
  ADD COLUMN concept_description TEXT,    -- para servicios
  ADD CONSTRAINT chk_sii_product_or_service CHECK (
    (item_type IN ('GOODS_RESALE','GOODS_INTERNAL') AND product_id IS NOT NULL)
    OR (item_type = 'SERVICE' AND concept_description IS NOT NULL)
  );`));

ch.push(h2("5.4 Estados (status y payment_status)"));
ch.push(makeTable([
  ["Estado","Significado"],
  ["status: RECEIVED","Factura capturada al recibirla del proveedor"],
  ["status: VALIDATED","Validada contra OC y goods_receipt"],
  ["status: PAID","Pago aplicado"],
  ["status: CANCELLED","Cancelada (por error o por proveedor)"],
  ["payment_status: UNPAID","Sin pago aún"],
  ["payment_status: PARTIAL","Pago parcial recibido"],
  ["payment_status: PAID","100% pagada"]
], [3000, 6360]));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 6. VALIDACIÓN DE CADENA ESTRICTA
ch.push(h1("6. Validación de cadena estricta (triggers)"));

ch.push(h2("6.1 fn_validate_invoice_chain"));
ch.push(p("Antes de cambiar payment_status a PAID en supplier_invoices, valida que exista al menos un goods_receipt asociado (excepto facturas de SERVICES)."));
ch.push(code(
`CREATE FUNCTION fn_validate_invoice_chain() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payment_status = 'PAID' AND OLD.payment_status <> 'PAID' THEN
        IF NEW.invoice_type IN ('GOODS','MIXED') AND NOT EXISTS (
            SELECT 1 FROM goods_receipts WHERE supplier_invoice_id = NEW.invoice_id
        ) THEN
            RAISE EXCEPTION 'No se puede marcar como PAID factura de bienes sin recepción registrada.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;`));

ch.push(h2("6.2 fn_validate_po_has_request"));
ch.push(p("Antes de pasar PO a CONFIRMED en bienes, valida que tenga al menos un item vinculado a un purchase_request."));
ch.push(code(
`-- En el trigger:
IF NEW.po_type = 'GOODS' AND NOT EXISTS (
    SELECT 1 FROM purchase_order_items poi
    WHERE poi.po_id = NEW.po_id AND poi.request_item_id IS NOT NULL
) THEN
    RAISE EXCEPTION 'PO de bienes no puede confirmarse sin items vinculados a una purchase_request.';
END IF;`));

ch.push(h2("6.3 Vista v_purchase_chain"));
ch.push(p("Trazabilidad completa en una sola consulta:"));
ch.push(code(
`SELECT * FROM v_purchase_chain WHERE request_number = 'PR-2026-100';

-- Devuelve, por cada renglón:
-- request_number, pri_line, item_type, item_description, quantity_requested,
-- po_number, quantity_ordered, quantity_received,
-- receipt_number, receipt_date,
-- invoice_number, invoice_date, payment_status,
-- sat_payment_form_id, sat_payment_method_id, is_credit`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 7. SERVICIOS
ch.push(h1("7. Compra de servicios"));

ch.push(p("Los servicios siguen el mismo flujo PR → PO → invoice, pero saltan el paso de goods_receipt porque no son inventariables."));

ch.push(h2("7.1 Cómo se diferencia"));
ch.push(makeTable([
  ["Atributo","Bienes","Servicios"],
  ["product_id","NOT NULL","NULL permitido"],
  ["service_description","NULL","NOT NULL"],
  ["unit_of_measure","de products.sat_unit","'hora','visita','servicio'"],
  ["item_type","GOODS_RESALE / GOODS_INTERNAL","SERVICE"],
  ["¿Genera GR?","Sí","No"],
  ["¿Afecta inventario?","Sí","No"],
  ["Cadena al pagar","Requiere GR","No requiere GR"]
], [2300, 3000, 4060]));

ch.push(h2("7.2 Ejemplo de flujo de servicio"));
ch.push(code(
`-- 1. Solicitud de mantenimiento
INSERT INTO purchase_requests (request_number, ...) VALUES ('PR-SRV-100', ...);
INSERT INTO purchase_request_items (
    request_id, line_number, item_type, service_description,
    unit_of_measure, quantity_requested
) VALUES (
    pr_id, 1, 'SERVICE', 'Mantenimiento preventivo prensa hidráulica',
    'visita', 1
);

-- 2. PO al proveedor de servicios
INSERT INTO purchase_orders (po_type, supplier_id, ...) VALUES ('SERVICES', s_id, ...);

-- 3. Factura recibida
INSERT INTO supplier_invoices (
    invoice_type, sat_payment_form_id, sat_payment_method_id, ...
) VALUES (
    'SERVICES', '03', 'PUE', ...
);

-- 4. Pago directo (no se requiere goods_receipt)
UPDATE supplier_invoices SET payment_status = 'PAID' WHERE ...;`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 8. GASTOS OPERATIVOS
ch.push(h1("8. Gastos operativos (operating_expenses)"));
ch.push(p("Flujo independiente para gastos no inventariables que NO requieren PR/PO: viáticos, fijos como renta, internet, gasolina, comidas con clientes, etc."));

ch.push(h2("8.1 Tabla extendida"));
ch.push(code(
`CREATE TABLE operating_expenses (
    expense_id          BIGINT PK,
    expense_number      TEXT,
    supplier_id         BIGINT FK suppliers (puede ser NULL si es ocasional),
    supplier_rfc        CITEXT,                           -- snapshot
    concept             TEXT NOT NULL,
    category            TEXT NOT NULL,                    -- Servicios, Viáticos, Fijos, etc.
    expense_date        DATE NOT NULL,
    invoice_folio       TEXT,
    uuid_sat            TEXT,                             -- (NUEVO) UUID si tiene CFDI
    is_deductible       BOOLEAN,
    payment_method      TEXT,                             -- legacy (texto libre)
    sat_payment_form_id TEXT FK sat_payment_forms,        -- (NUEVO)
    sat_payment_method_id TEXT FK sat_payment_methods,    -- (NUEVO)
    is_credit           BOOLEAN GENERATED ALWAYS AS (sat_payment_method_id = 'PPD') STORED,
    status              TEXT (PENDING, PAID, CANCELLED),
    responsible_user_id BIGINT FK users,
    subtotal, tax_amount, total,
    notes
);`));

ch.push(h2("8.2 Categorías típicas"));
ch.push(makeTable([
  ["category","Ejemplos"],
  ["Servicios","Internet, telefonía, electricidad, agua"],
  ["Viáticos","Hospedaje, comidas, transporte de empleados"],
  ["Fijos","Renta de oficina, sueldos administrativos"],
  ["Combustibles","Gasolina, diésel para flota"],
  ["Mantenimiento","Limpieza, reparaciones menores"],
  ["Honorarios","Asesoría contable, legal, fiscal"],
  ["Otros","Lo no clasificable"]
], [2400, 6960]));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 9. EJEMPLO COMPLETO
ch.push(h1("9. Ejemplo extremo a extremo"));
ch.push(p("Compra mixta: necesito 10 cilindros para venta + 2 toners para oficina + 1 servicio de mantenimiento."));

ch.push(h2("9.1 Paso 1: Solicitud de material (PR)"));
ch.push(code(
`INSERT INTO purchase_requests (request_number, requested_by, status)
VALUES ('PR-2026-100', user_id, 'APPROVED');

INSERT INTO purchase_request_items (request_id, line_number, item_type, ...) VALUES
  (pr_id, 1, 'GOODS_RESALE',  product_id=cilindro_id,  qty=10, unit='pieza'),
  (pr_id, 2, 'GOODS_INTERNAL', product_id=toner_id,    qty=2,  unit='pieza'),
  (pr_id, 3, 'SERVICE',       service_description='Mantenimiento preventivo prensa',
                              quantity_requested=1, unit='visita');`));

ch.push(h2("9.2 Paso 2: Una OC mixta a un proveedor"));
ch.push(code(
`INSERT INTO purchase_orders (po_number, supplier_id, po_type, status)
VALUES ('PO-2026-200', festo_id, 'MIXED', 'CONFIRMED');

INSERT INTO purchase_order_items (po_id, request_item_id, item_type, ...) VALUES
  (po_id, pri_1, 'GOODS_RESALE',  product_id=cilindro_id, qty_ordered=10, unit_cost=2100),
  (po_id, pri_2, 'GOODS_INTERNAL', product_id=toner_id,   qty_ordered=2,  unit_cost=850),
  (po_id, pri_3, 'SERVICE',       service_description='Mantenimiento preventivo',
                                  qty_ordered=1, unit_cost=5000);`));

ch.push(h2("9.3 Paso 3: Recepción solo de los bienes"));
ch.push(code(
`-- El servicio NO se recepciona; solo los GOODS
INSERT INTO goods_receipts (receipt_number, po_id, supplier_id, receipt_date, ...)
VALUES ('GR-2026-300', po_id, festo_id, CURRENT_DATE, ...);

INSERT INTO goods_receipt_items (receipt_id, po_item_id, product_id, quantity_received, unit_cost) VALUES
  (gr_id, poi_1, cilindro_id, 10, 2100),
  (gr_id, poi_2, toner_id,    2,  850);
-- → Trigger crea 2 inventory_movements RECEIPT
-- → Trigger recalcula current_avg_cost para ambos productos`));

ch.push(h2("9.4 Paso 4: Factura del proveedor (cubre todo)"));
ch.push(code(
`INSERT INTO supplier_invoices (
    supplier_id, invoice_number, invoice_type, invoice_date,
    sat_payment_form_id, sat_payment_method_id,
    subtotal, tax_amount, total,
    status, payment_status
) VALUES (
    festo_id, 'A-12345', 'MIXED', '2026-04-20',
    '03',           -- Forma SAT: Transferencia
    'PPD',          -- Método: a crédito
    27000, 4320, 31320,
    'RECEIVED', 'UNPAID'
);
-- is_credit se calcula automáticamente como TRUE`));

ch.push(h2("9.5 Paso 5: Pago"));
ch.push(code(
`-- Trigger fn_validate_invoice_chain valida que exista goods_receipt para invoice_type=MIXED
UPDATE supplier_invoices
   SET payment_status = 'PAID',
       payment_date = '2026-05-20',
       status = 'PAID'
WHERE invoice_id = X;
-- ✓ Pasa la validación porque hay goods_receipt asociado`));

ch.push(h2("9.6 Verificación: cadena completa"));
ch.push(code(
`SELECT * FROM v_purchase_chain WHERE request_number = 'PR-2026-100';

-- Devuelve los 3 renglones con su trazabilidad completa:
-- línea 1 (cilindros):     PR → PO → GR → INV → PAID
-- línea 2 (toner):         PR → PO → GR → INV → PAID
-- línea 3 (mantenimiento): PR → PO → ----- → INV → PAID  (sin GR, es servicio)`));

const doc = new Document({
  creator: "Sistema RTB", title: "Módulo de Compras",
  styles: {
    default: { document: { run: { font: ARIAL, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: ARIAL, color: DARK },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: ARIAL, color: DARK },
        paragraph: { spacing: { before: 240, after: 180 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: ARIAL, color: "374151" },
        paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 2 } }
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }
    ]
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 },
                          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "RTB · Compras", font: ARIAL, size: 18, color: GRAY })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Página ", font: ARIAL, size: 18, color: GRAY }),
                 new TextRun({ children: [PageNumber.CURRENT], font: ARIAL, size: 18, color: GRAY })] })] }) },
    children: ch
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/sessions/bold-dazzling-brahmagupta/mnt/outputs/rtb/12_modulo_compras.docx", buf);
  console.log("DOCX listo:", buf.length, "bytes");
});

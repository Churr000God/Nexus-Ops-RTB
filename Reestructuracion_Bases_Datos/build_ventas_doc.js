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
        borders,
        width: { size: widths[ci], type: WidthType.DXA },
        shading: idx === 0 ? { fill: DARK, type: ShadingType.CLEAR } : undefined,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({
            text: String(cell), font: ARIAL, size: 20, bold: idx === 0,
            color: idx === 0 ? "FFFFFF" : DARK
          })]
        })]
      }))
    }))
  });
}

const ch = [];

ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 240 },
  children: [new TextRun({ text: "Módulo de Ventas", font: ARIAL, size: 56, bold: true })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
  children: [new TextRun({ text: "y Logística", font: ARIAL, size: 56, bold: true })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360, after: 120 },
  children: [new TextRun({ text: "Sistema RTB · PostgreSQL", font: ARIAL, size: 28, color: GRAY })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "Cotizaciones · Notas remisión · Pedidos · Envíos · Rutas · Pagos · Facturación", font: ARIAL, size: 18, color: GRAY })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 },
  children: [new TextRun({ text: "Documento de diseño y operación · v1.0", font: ARIAL, size: 22, color: GRAY })] }));
ch.push(new Paragraph({ children: [new PageBreak()] }));

// 1. INTRO
ch.push(h1("1. Introducción"));
ch.push(p("Este documento describe el módulo más extenso del sistema: el ciclo completo de venta desde la nota de remisión informal hasta el cobro final, pasando por cotización formal, pedido, empacado, envío, ruta, entrega, facturación, cancelación y reexpedición de CFDI."));
ch.push(p("Cubre 14 tablas y 5 vistas, distribuidas en cuatro grupos:"));
ch.push(makeTable([
  ["Grupo","Tablas"],
  ["Notas de remisión","delivery_notes, delivery_note_items, quote_delivery_notes (junction)"],
  ["Cotizaciones y pedidos","quotes, quote_items, quote_status_history, orders, order_items, order_milestones"],
  ["Logística","carriers, shipments, shipment_items, shipment_tracking_events, routes, route_stops"],
  ["Vistas derivadas","v_order_packing_progress, v_order_payment_status, v_orders_incomplete_tracking, v_shipments_overview, v_cfdi_cancellations"]
], [3000, 6360]));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 2. FLUJO COMPLETO
ch.push(h1("2. Flujo extremo a extremo"));
ch.push(p("El flujo completo soporta dos escenarios:"));

ch.push(h2("2.1 Escenario A: Flujo formal directo"));
ch.push(code(
`Cliente envía PO formal
       │
       ▼
   Cotización → APPROVED → (trigger crea) Pedido
                                              │
                                              ├─► Empacado (quantity_packed)
                                              │
                                              ├─► Asignación a Ruta
                                              │
                                              ├─► Envío (Shipment + Carrier + Tracking)
                                              │
                                              ├─► Entrega → Milestone DELIVERED
                                              │
                                              ├─► CFDI emitido (timbrado en PAC)
                                              │
                                              └─► Pagos (1+) → marcado PAID`));

ch.push(h2("2.2 Escenario B: Flujo con nota de remisión"));
ch.push(code(
`Material urgente: se entrega ANTES de cotización formal
       │
       ▼
   Nota Remisión 1 (3 productos) → ENTREGADA físicamente
   Nota Remisión 2 (2 productos) → ENTREGADA físicamente
       │
       │  Llega la OC del cliente
       ▼
   Cotización formal (consolida items de NR1 + NR2)
       │
       ├─► Asociación a NRs vía quote_delivery_notes
       │   (NR.status pasa a TRANSFORMED)
       ▼
   Pedido → CFDI único
       │
       ▼
   NR.status → INVOICED`));

ch.push(p("La pieza clave es la tabla puente quote_delivery_notes: relación N:N permite que una NR genere varias quotes, o que varias NRs se consoliden en una quote."));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 3. NOTAS DE REMISIÓN
ch.push(h1("3. Notas de remisión (delivery_notes)"));

ch.push(p("La NR es una cotización informal con entrega física. Concepto del negocio:"));
ch.push(bullet("Cliente necesita material urgente, sin OC formal todavía."));
ch.push(bullet("Se entrega el material a crédito, documentando con NR."));
ch.push(bullet("La NR contiene SKUs, cantidades, precios snapshot."));
ch.push(bullet("Cuando llega la OC del cliente, se transforma en cotización(es) formal(es)."));
ch.push(bullet("La cotización genera el pedido y el CFDI normales."));

ch.push(h2("3.1 delivery_notes"));
ch.push(code(
`CREATE TABLE delivery_notes (
    delivery_note_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    note_number           TEXT NOT NULL UNIQUE,
    customer_id           BIGINT NOT NULL REFERENCES customers(customer_id),
    shipping_address_id   BIGINT REFERENCES customer_addresses(address_id),
    sales_rep_id          BIGINT REFERENCES users(user_id),
    issue_date            DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date         DATE,
    status                TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','ISSUED','DELIVERED','TRANSFORMED','PARTIALLY_INVOICED','INVOICED','CANCELLED')),
    customer_po_number    TEXT,
    customer_po_date      DATE,
    subtotal              NUMERIC(14,4) NOT NULL DEFAULT 0,
    tax_amount            NUMERIC(14,4) NOT NULL DEFAULT 0,
    total                 NUMERIC(14,4) NOT NULL DEFAULT 0,
    notes                 TEXT,
    cancelled_at          TIMESTAMPTZ,
    cancellation_reason   TEXT,
    created_at, updated_at TIMESTAMPTZ
);`));

ch.push(h3("Estados"));
ch.push(makeTable([
  ["Estado","Significado"],
  ["DRAFT","Capturada pero no enviada"],
  ["ISSUED","Emitida (lista para entregarse)"],
  ["DELIVERED","Material entregado físicamente al cliente"],
  ["TRANSFORMED","Asociada a una cotización formal vía quote_delivery_notes"],
  ["PARTIALLY_INVOICED","Parte de los items ya está en una CFDI"],
  ["INVOICED","Todos los items facturados"],
  ["CANCELLED","Cancelada antes de facturar (requiere motivo)"]
], [2400, 6960]));

ch.push(h2("3.2 quote_delivery_notes — la tabla puente"));
ch.push(code(
`CREATE TABLE quote_delivery_notes (
    quote_id          BIGINT NOT NULL REFERENCES quotes(quote_id) ON DELETE CASCADE,
    delivery_note_id  BIGINT NOT NULL REFERENCES delivery_notes(delivery_note_id),
    associated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    associated_by     BIGINT REFERENCES users(user_id),
    notes             TEXT,
    PRIMARY KEY (quote_id, delivery_note_id)
);`));
ch.push(p("Permite todos los escenarios:"));
ch.push(bullet("1 NR → 1 cotización (caso simple)"));
ch.push(bullet("2 NRs → 1 cotización (consolidación: la OC del cliente cubre las dos)"));
ch.push(bullet("1 NR → 2 cotizaciones (división: si los items se separan en facturas distintas)"));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 4. ENVÍOS Y FLETERAS
ch.push(h1("4. Envíos, fletera y tracking"));

ch.push(h2("4.1 carriers"));
ch.push(p("Catálogo de fleteras propias y externas."));
ch.push(code(
`CREATE TABLE carriers (
    carrier_id            BIGINT PK,
    code                  TEXT UNIQUE,    -- 'FEDEX', 'DHL', 'INTERNA-1'
    name                  TEXT NOT NULL,
    contact_name, phone, email,
    tracking_url_template TEXT,           -- 'https://fedex.com/track?n={tracking}'
    is_internal           BOOLEAN,        -- TRUE = camioneta propia
    is_active             BOOLEAN
);`));

ch.push(h2("4.2 shipments"));
ch.push(p("Cada envío físico desde RTB hacia el cliente. Un pedido puede partirse en varios shipments."));
ch.push(code(
`CREATE TABLE shipments (
    shipment_id           BIGINT PK,
    shipment_number       TEXT UNIQUE,
    order_id              BIGINT NOT NULL FK orders,
    delivery_note_id      BIGINT FK delivery_notes,    -- si va con NR
    customer_address_id   BIGINT FK customer_addresses,
    carrier_id            BIGINT FK carriers,
    tracking_number       TEXT,                         -- guía
    tracking_url          TEXT,
    status                TEXT (PREPARING, READY, IN_TRANSIT, DELIVERED, RETURNED, INCIDENT, CANCELLED),
    shipping_cost, shipping_date, estimated_arrival, actual_arrival,
    received_by_name      TEXT,            -- quién firmó
    delivery_evidence_url TEXT,            -- foto, firma escaneada
    incident_notes        TEXT
);`));

ch.push(h2("4.3 shipment_items y tracking"));
ch.push(p("Cada partida del shipment apunta al order_item correspondiente. Un trigger sincroniza order_items.quantity_shipped automáticamente."));
ch.push(code(
`-- Trigger fn_sync_shipped_qty:
-- INSERT  → order_items.quantity_shipped += NEW.quantity
-- UPDATE  → order_items.quantity_shipped += (NEW.quantity - OLD.quantity)
-- DELETE  → order_items.quantity_shipped -= OLD.quantity`));

ch.push(p("shipment_tracking_events captura el seguimiento (eventos del transportista o capturas manuales):"));
ch.push(makeTable([
  ["event_date","location","status_code","description"],
  ["2026-04-27 08:00","Almacén RTB","PICKED_UP","Material recolectado y en ruta"],
  ["2026-04-27 14:30","CDMX","IN_TRANSIT","En tránsito hacia destino"],
  ["2026-04-28 09:15","Vallejo","DELIVERED","Entregado a Juan Pérez (firmó de recibido)"]
], [2400, 1700, 2000, 3260]));

ch.push(p("Cuando shipments.status pasa a DELIVERED, el trigger fn_on_shipment_delivered actualiza orders.delivery_date e inserta milestone DELIVERED automáticamente."));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 5. RUTAS
ch.push(h1("5. Rutas"));
ch.push(p("Una ruta es la planeación de un viaje: combina entregas a clientes (DELIVERY) y recolecciones de proveedores (PICKUP) en orden."));

ch.push(h2("5.1 routes"));
ch.push(code(
`CREATE TABLE routes (
    route_id          BIGINT PK,
    route_number      TEXT UNIQUE,
    route_date        DATE,
    driver_user_id    BIGINT FK users,
    vehicle_plate, vehicle_label,
    status            TEXT (PLANNING, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED),
    start_time, end_time,
    total_distance_km
);`));

ch.push(h2("5.2 route_stops"));
ch.push(code(
`CREATE TABLE route_stops (
    stop_id             BIGINT PK,
    route_id            BIGINT FK routes,
    stop_order          SMALLINT,                  -- orden secuencial
    stop_type           TEXT (DELIVERY | PICKUP),
    -- Si DELIVERY:
    customer_address_id, shipment_id,
    -- Si PICKUP:
    supplier_address_id, purchase_order_id, goods_receipt_id,
    estimated_arrival, actual_arrival, actual_departure,
    status              TEXT (PENDING, EN_ROUTE, ARRIVED, COMPLETED, FAILED, SKIPPED),
    failure_reason
);`));

ch.push(p("CHECK constraint garantiza que una parada sea DELIVERY (con shipment_id) O PICKUP (con purchase_order_id), nunca ambos."));

ch.push(h2("5.3 Ejemplo de ruta del día"));
ch.push(makeTable([
  ["stop_order","stop_type","Descripción","status"],
  ["1","DELIVERY","SHP-100 → Femsa Vallejo","COMPLETED"],
  ["2","PICKUP","PO-2026-045 → Festo Tlalnepantla","COMPLETED"],
  ["3","DELIVERY","SHP-101 → Coca-Cola Femsa","ARRIVED"],
  ["4","PICKUP","PO-2026-046 → SMC","PENDING"],
  ["5","DELIVERY","SHP-102 → CEDIS Norte","PENDING"]
], [1500, 1700, 4000, 2160]));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 6. PAGOS
ch.push(h1("6. Pagos parciales y seguimiento"));
ch.push(p("Los pagos se modelan en dos tablas (ya existentes): payments y payment_applications. Cada parcialidad es una fila en payments con su fecha y monto. La aplicación contra órdenes/CFDIs se hace en payment_applications."));

ch.push(h2("6.1 Vista v_order_payment_status"));
ch.push(code(
`SELECT * FROM v_order_payment_status WHERE order_number = 'ORD-2026-001';

-- Devuelve:
-- order_number   total      amount_paid   amount_pending   computed_payment_status
-- ORD-2026-001   100,000    60,000        40,000           PARTIAL
-- first_payment_date   last_payment_date   num_payments
-- 2026-03-15           2026-04-10          2`));

ch.push(p("La vista te dice exactamente: el cliente debe $40,000, ha hecho 2 pagos parciales, el primero el 15 de marzo y el último el 10 de abril."));

ch.push(h2("6.2 Detalle de cada pago aplicado"));
ch.push(code(
`SELECT p.payment_date, p.amount, pa.amount_applied, pa.cfdi_id, pa.order_id, p.bank_reference
FROM payments p
JOIN payment_applications pa ON pa.payment_id = p.payment_id
WHERE pa.order_id = 42
ORDER BY p.payment_date;`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 7. FACTURACIÓN: cancelación y reexpedición
ch.push(h1("7. Cancelación y reexpedición de CFDI"));

ch.push(h2("7.1 Campos agregados a cfdi"));
ch.push(code(
`ALTER TABLE cfdi
    ADD COLUMN replaces_cfdi_id    BIGINT REFERENCES cfdi,  -- "Este CFDI sustituye al X"
    ADD COLUMN replaced_by_cfdi_id BIGINT REFERENCES cfdi,  -- "Este fue sustituido por X"
    ADD COLUMN sat_cancellation_motive TEXT
        CHECK (sat_cancellation_motive IN ('01','02','03','04')),
    ADD COLUMN sat_cancellation_uuid_substitute TEXT;`));

ch.push(h2("7.2 Motivos SAT de cancelación"));
ch.push(makeTable([
  ["Motivo","Significado","Requiere replaced_by_cfdi_id"],
  ["01","Comprobante con errores con relación","SÍ"],
  ["02","Comprobante con errores sin relación","No"],
  ["03","No se llevó a cabo la operación","No"],
  ["04","Operación nominativa relacionada en factura global","No"]
], [1500, 5000, 2860]));

ch.push(h2("7.3 Flujo de cancelación con sustitución"));
ch.push(numList("Detectar error en CFDI A (uuid: AAA111)."));
ch.push(numList("Crear CFDI B con datos correctos. Marcar B.replaces_cfdi_id = A. Timbrar B."));
ch.push(numList("Cancelar CFDI A en el SAT con motivo '01' y sat_cancellation_uuid_substitute = uuid_de_B."));
ch.push(numList("Actualizar A: status=CANCELLED, replaced_by_cfdi_id = B."));

ch.push(h2("7.4 Vista v_cfdi_cancellations"));
ch.push(code(
`-- Lista todas las cancelaciones con su sustituto si aplica
SELECT * FROM v_cfdi_cancellations
WHERE cancelled_at >= now() - INTERVAL '30 days';`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 8. EMPACADO Y AVANCE
ch.push(h1("8. Empacado y avance"));
ch.push(p("Cada vez que el almacén actualiza order_items.quantity_packed, dos cosas suceden:"));
ch.push(numList("Trigger fn_create_inv_movement_from_packing inserta un inventory_movement tipo ISSUE (baja stock)."));
ch.push(numList("Vista v_order_packing_progress refleja el nuevo % empacado."));

ch.push(h2("8.1 Vista de avance"));
ch.push(code(
`SELECT * FROM v_order_packing_progress WHERE order_number = 'ORD-2026-001';

-- Devuelve:
-- order_number   customer       qty_ordered  qty_packed  packed_pct  computed_status   assigned_packer
-- ORD-2026-001   Femsa Vallejo  100          80          80.00       IN_PROGRESS       María López`));

ch.push(h2("8.2 packing_status manual"));
ch.push(p("Aparte del cálculo automático, orders.packing_status permite un estado manual del empacado para planeación de rutas:"));
ch.push(makeTable([
  ["packing_status","Significado"],
  ["NOT_STARTED","Aún no se inicia el empacado"],
  ["IN_PROGRESS","Empacando (parcialmente)"],
  ["READY","Empacado completo, listo para asignar a ruta"],
  ["PACKED_FOR_ROUTE","Asignado a una ruta específica"],
  ["DISPATCHED","Salió en la ruta"]
], [2400, 6960]));

// 9. PEDIDOS INCOMPLETOS
ch.push(h1("9. Pedidos incompletos: seguimiento"));
ch.push(p("Reemplaza la tabla 'Pedidos Incompletos' del Notion viejo. Es una vista derivada."));
ch.push(code(
`SELECT * FROM v_orders_incomplete_tracking
WHERE qty_pending_to_ship > 0
ORDER BY days_open DESC;`));

ch.push(p("Devuelve los pedidos con material aún no embarcado, ordenados por antigüedad. Cuando se completan (qty_pending_to_ship = 0), salen automáticamente de la vista filtrada y la columna completion_date se llena."));

ch.push(h2("9.1 Cuándo se considera completo"));
ch.push(code(
`completion_date =
    SI SUM(quantity_ordered) = SUM(quantity_shipped)
       MAX(o.delivery_date)
    SI NO
       NULL`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 10. RELACIONES
ch.push(h1("10. Cómo se conecta todo"));
ch.push(code(
`        delivery_notes (informal)
              │
              │  N:N quote_delivery_notes
              ▼
   ─────► quotes ──► quote_items ──► quote_status_history
              │
              │  trigger fn_create_order_from_approved_quote
              ▼
          orders ──► order_items ──► (trigger ISSUE en inventario)
              │
              ├──► order_milestones (CREATED, APPROVED, SHIPPED, ...)
              │
              ├──► shipments ──► shipment_items
              │       │
              │       ├──► shipment_tracking_events
              │       │
              │       └──► route_stops (DELIVERY) ◄── routes
              │
              ├──► cfdi ──► cfdi_items
              │       │
              │       ├──► cfdi_credit_notes (NC tipo E)
              │       ├──► cfdi_payments (complementos)
              │       ├──► replaces / replaced_by (cancelaciones)
              │       └──► cfdi_delivery_notes? (eliminada — la consolidación es a nivel quote)
              │
              └──► payments ──► payment_applications`));

ch.push(h2("10.1 Permisos relevantes"));
ch.push(makeTable([
  ["Permiso","Roles"],
  ["delivery_note.create / .manage","SALES, ADMIN"],
  ["delivery_note.invoice","ACCOUNTING, ADMIN"],
  ["shipment.create / .manage","WAREHOUSE, ADMIN"],
  ["shipment.track.update","WAREHOUSE, SALES, ADMIN"],
  ["route.create / .manage","WAREHOUSE, ADMIN"],
  ["route.execute","Driver (rol nuevo) o WAREHOUSE"]
], [3500, 5860]));

const doc = new Document({
  creator: "Sistema RTB", title: "Módulo de Ventas y Logística",
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
      children: [new TextRun({ text: "RTB · Ventas y Logística", font: ARIAL, size: 18, color: GRAY })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Página ", font: ARIAL, size: 18, color: GRAY }),
                 new TextRun({ children: [PageNumber.CURRENT], font: ARIAL, size: 18, color: GRAY })] })] }) },
    children: ch
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/sessions/bold-dazzling-brahmagupta/mnt/outputs/rtb/11_modulo_ventas_logistica.docx", buf);
  console.log("DOCX listo:", buf.length, "bytes");
});

// Genera 06_logica_negocio.docx
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, Header, Footer, PageOrientation,
  PageBreak, TableOfContents
} = require('docx');

const ARIAL = "Arial";

const heading = (text, level) => new Paragraph({
  heading: level,
  children: [new TextRun({ text, font: ARIAL })]
});
const h1 = (t) => heading(t, HeadingLevel.HEADING_1);
const h2 = (t) => heading(t, HeadingLevel.HEADING_2);
const h3 = (t) => heading(t, HeadingLevel.HEADING_3);
const p  = (t, opts={}) => new Paragraph({
  children: [new TextRun({ text: t, font: ARIAL, ...opts })],
  spacing: { after: 120 }
});
const pBold = (t) => p(t, { bold: true });
const pItalic = (t) => p(t, { italics: true });

const bullet = (t) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  children: [new TextRun({ text: t, font: ARIAL })]
});
const numList = (t) => new Paragraph({
  numbering: { reference: "numbers", level: 0 },
  children: [new TextRun({ text: t, font: ARIAL })]
});

// Tabla helper
const border = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

function makeTable(rows, columnWidths) {
  const totalWidth = columnWidths.reduce((a,b)=>a+b,0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths,
    rows: rows.map((row, idx) => new TableRow({
      tableHeader: idx === 0,
      children: row.map((cell, cIdx) => new TableCell({
        borders,
        width: { size: columnWidths[cIdx], type: WidthType.DXA },
        shading: idx === 0 ? { fill: "1F2937", type: ShadingType.CLEAR } : undefined,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({
            text: String(cell),
            font: ARIAL,
            size: 20,
            bold: idx === 0,
            color: idx === 0 ? "FFFFFF" : "1F2937"
          })]
        })]
      }))
    }))
  });
}

const children = [];

// ================================================================
// PORTADA
// ================================================================
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 2400, after: 240 },
  children: [new TextRun({ text: "Sistema RTB", font: ARIAL, size: 56, bold: true })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 120 },
  children: [new TextRun({ text: "Lógica de negocio y reglas operativas", font: ARIAL, size: 32 })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 240 },
  children: [new TextRun({ text: "Migración Notion + n8n → PostgreSQL", font: ARIAL, size: 24, italics: true, color: "6B7280" })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 1200 },
  children: [new TextRun({ text: "Documento técnico-funcional · v1.0", font: ARIAL, size: 22, color: "6B7280" })]
}));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 1. INTRODUCCIÓN
// ================================================================
children.push(h1("1. Introducción"));
children.push(p("Este documento describe la lógica de negocio del sistema RTB rediseñado, que reemplaza el sistema actual basado en bases de datos de Notion sincronizadas con flujos de n8n. El destino es un esquema relacional en PostgreSQL 14+ con integridad referencial, cálculos auditables y soporte nativo para CFDI 4.0 SAT."));
children.push(p("RTB opera como un negocio B2B de venta de maquinaria industrial y partes (productos configurables) a clientes mexicanos. La operación cubre cuatro procesos principales: ventas, compras, inventario y facturación electrónica. Este documento describe el flujo extremo a extremo, las reglas de negocio, las transiciones de estado y las validaciones que el sistema debe garantizar."));

children.push(h2("1.1 Alcance"));
children.push(bullet("Procesos cubiertos: ventas (cotización → orden → factura → pago), compras (solicitud → orden → recepción → factura proveedor → pago), inventario (entradas, salidas, ajustes, no conformes), facturación electrónica CFDI 4.0 (incluyendo notas de crédito y complementos de pago) y gastos operativos."));
children.push(bullet("Procesos no cubiertos en esta versión: garantías, servicio post-venta, trazabilidad por número de serie, multi-almacén, multi-empresa."));

children.push(h2("1.2 Glosario"));
children.push(makeTable([
  ["Término", "Significado"],
  ["SKU", "Stock Keeping Unit. Identificador único de un producto en el catálogo."],
  ["BOM", "Bill of Materials. Lista de componentes que conforman un producto ensamblado."],
  ["OC", "Orden de Compra emitida a un proveedor."],
  ["CFDI", "Comprobante Fiscal Digital por Internet (factura electrónica México)."],
  ["PAC", "Proveedor Autorizado de Certificación (timbra el CFDI)."],
  ["UUID fiscal", "Identificador único del CFDI asignado por el SAT al timbrar."],
  ["NC", "No Conforme. Material recibido o detectado con defecto que requiere ajuste de inventario."],
  ["TDP", "Tamaño de paquete. Múltiplo en el que se compra/vende un SKU."],
  ["PEPS", "Primero en Entrar, Primero en Salir (método de valuación)."]
], [2400, 6960]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 2. ROLES
// ================================================================
children.push(h1("2. Roles y permisos"));
children.push(p("El sistema implementa un modelo de control de acceso basado en roles (RBAC). Cada usuario puede tener uno o varios roles, y cada rol agrupa un conjunto de permisos granulares por entidad y acción."));

children.push(makeTable([
  ["Rol", "Responsabilidades principales"],
  ["ADMIN", "Configuración del sistema, gestión de usuarios y roles, acceso total."],
  ["SALES", "Crea cotizaciones, gestiona clientes, da seguimiento a pedidos, no edita inventario."],
  ["PURCHASING", "Crea solicitudes de material, OCs a proveedores, gestiona facturas de compra."],
  ["WAREHOUSE", "Registra entradas de mercancía, valida físicamente, gestiona no conformes y ajustes."],
  ["ACCOUNTING", "Emite CFDI, registra pagos, gestiona gastos operativos, conciliación."]
], [2160, 7200]));

children.push(p("Cada cambio relevante en cotizaciones, órdenes, CFDI, movimientos de inventario y OCs queda registrado en la tabla audit_log con el usuario responsable, la acción y el snapshot del estado antes/después."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 3. FLUJO DE VENTA
// ================================================================
children.push(h1("3. Flujo de venta"));
children.push(p("El proceso de venta sigue una secuencia formal: el cliente envía una solicitud (típicamente con un PO), se construye una cotización, al ser aprobada se convierte en pedido, el pedido se surte y entrega, y al final se factura. Cada paso tiene su tabla, sus estados y sus transiciones controladas."));

children.push(h2("3.1 Diagrama de estados"));
children.push(pItalic("quote.status:  DRAFT → SENT → APPROVED → (pedido creado) | REJECTED | CANCELLED | EXPIRED"));
children.push(pItalic("order.status:  PENDING → PARTIALLY_PACKED → READY_TO_SHIP → SHIPPED → DELIVERED → INVOICED → PAID | CANCELLED"));
children.push(pItalic("order.payment_status:  UNPAID → PARTIAL → PAID | OVERDUE | REFUNDED"));

children.push(h2("3.2 Cotización"));
children.push(numList("El vendedor crea una cotización (quotes) en estado DRAFT, asociada a un cliente y opcionalmente a una dirección de envío."));
children.push(numList("Se agregan partidas (quote_items) — una por SKU. Si el SKU es configurable, se referencia un product_configuration con los atributos específicos (voltaje, dimensión, etc.)."));
children.push(numList("Cada partida toma el costo de compra como snapshot del proveedor preferido (supplier_products.unit_cost vigente). Esto permite calcular el margen al cotizar."));
children.push(numList("Los totales (subtotal, IVA, total) se calculan automáticamente vía trigger al insertar/modificar partidas."));
children.push(numList("Al enviarla al cliente, status pasa a SENT. Se registra fecha de seguimiento y vigencia."));
children.push(numList("Cliente aprueba → status APPROVED. Un trigger crea automáticamente la orden (orders) con sus partidas (order_items) copiadas del quote."));
children.push(numList("Si el cliente cancela o expira, status pasa a CANCELLED o EXPIRED con motivo y fecha. No se crea tabla aparte."));

children.push(h2("3.3 Orden"));
children.push(p("La orden representa el compromiso de surtir y entregar. Conserva una relación 1:1 con la cotización (orders.quote_id es UNIQUE)."));
children.push(numList("La orden inicia en PENDING. El responsable de surtido (fulfillment_user_id) revisa stock disponible."));
children.push(numList("Si hay stock suficiente, se procede a empacado: actualizar order_items.quantity_packed."));
children.push(numList("Cada incremento en quantity_packed dispara un inventory_movement tipo ISSUE — el inventario baja en tiempo real."));
children.push(numList("Si hay stock insuficiente, se genera una solicitud de material (purchase_request) con los faltantes. La orden queda con has_shortage = TRUE (lo que antes era 'Pedidos Incompletos')."));
children.push(numList("Cuando todo está empacado, status pasa a READY_TO_SHIP. Al despachar, SHIPPED. Al confirmar entrega, DELIVERED."));
children.push(numList("Cada transición se registra en order_milestones con su fecha y usuario (reemplaza el 'Verificador de fechas')."));

children.push(h2("3.4 Facturación al cliente"));
children.push(p("La factura se emite como CFDI 4.0 por la cantidad efectivamente entregada (order_items.quantity_shipped). Se permite facturación parcial: una orden puede generar uno o más CFDI hasta cubrir el total enviado."));
children.push(numList("Crear cabecera cfdi con tipo 'I' (Ingreso), datos fiscales del emisor (snapshot desde configuración de la empresa) y receptor (snapshot desde customer_tax_data)."));
children.push(numList("Por cada partida que se factura, crear cfdi_items con la clave de producto/servicio SAT y la clave de unidad SAT, además del IVA (16% por default), IEPS si aplica, y retenciones."));
children.push(numList("Definir uso de CFDI (ej. G01 — Adquisición de mercancías) y método de pago: PUE (Pago en Una Exhibición) si ya está pagado, PPD (Pago en Parcialidades o Diferido) si no."));
children.push(numList("Enviar el XML al PAC para timbrado. Recibir UUID, sello SAT, certificado y fecha de timbre. Persistir en la fila cfdi y actualizar status a TIMBRADO."));
children.push(numList("Actualizar order.invoice_status según corresponda: PARTIAL o INVOICED."));

children.push(h2("3.5 Pagos"));
children.push(p("Los pagos se registran en la tabla payments y se aplican a uno o varios CFDI mediante payment_applications. Esto permite manejar pagos parciales y aplicar un solo depósito a varias facturas."));
children.push(numList("Cuando el método de pago de la factura es PPD, cada pago recibido genera un complemento de pago (CFDI tipo P) en cfdi_payments."));
children.push(numList("El complemento captura: fecha de pago, forma de pago (transferencia, cheque, etc.), monto, parcialidad, saldo anterior, monto pagado y saldo restante."));
children.push(numList("Cuando el saldo restante llega a cero, order.payment_status pasa a PAID."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 4. FLUJO DE COMPRA
// ================================================================
children.push(h1("4. Flujo de compra"));

children.push(h2("4.1 Diagrama de estados"));
children.push(pItalic("purchase_request.status:   DRAFT → APPROVED → PARTIALLY_ORDERED → ORDERED | REJECTED | CANCELLED"));
children.push(pItalic("purchase_order.status:     DRAFT → SENT → CONFIRMED → PARTIAL_RECEIVED → RECEIVED → INVOICED → PAID | CANCELLED"));
children.push(pItalic("supplier_invoice.status:   RECEIVED → VALIDATED → PAID | CANCELLED"));

children.push(h2("4.2 Solicitud de material"));
children.push(numList("La solicitud (purchase_request) se origina por dos vías: (a) faltantes detectados al surtir un pedido, o (b) compra anticipada por stock mínimo / alerta."));
children.push(numList("Cada partida (purchase_request_items) referencia el SKU, la cantidad necesaria, opcionalmente el quote_item que la originó, y el proveedor sugerido."));
children.push(numList("Reglas de validación: si el producto está en bloqueo por inventario dormido, marcar exception_reason; si la cantidad es múltiplo del TDP, ajustar quantity_after_conversion."));

children.push(h2("4.3 Orden de compra"));
children.push(numList("Una OC (purchase_orders) agrupa partidas (purchase_order_items) compradas a un mismo proveedor. Tiene un folio único (po_number)."));
children.push(numList("El precio unit_cost se toma de supplier_products vigente. Si cambió desde la solicitud, se actualiza con autorización."));
children.push(numList("La OC se envía al proveedor (status SENT), se confirma (CONFIRMED), se recibe parcial o totalmente (PARTIAL_RECEIVED, RECEIVED), se factura (INVOICED) y se paga (PAID)."));

children.push(h2("4.4 Recepción de mercancía"));
children.push(numList("Al llegar el material físico, se crea un goods_receipt asociado a la OC y a la factura del proveedor."));
children.push(numList("Por cada partida recibida (goods_receipt_items) se registra quantity_received y unit_cost (con guardia contra división por cero)."));
children.push(numList("Un trigger crea automáticamente un inventory_movement tipo RECEIPT por la cantidad recibida, con el costo unitario calculado. El inventario sube en tiempo real."));
children.push(numList("Si hay material defectuoso, se crea una non_conformity con adjustment_type = OUT, lo que genera un inventory_movement tipo ADJUSTMENT_OUT que ajusta el stock."));

children.push(h2("4.5 Factura del proveedor y pago"));
children.push(numList("La factura del proveedor (supplier_invoices) se captura con número, fecha, subtotal, IVA, envío, seguro y descuentos."));
children.push(numList("Las partidas (supplier_invoice_items) se vinculan a las partidas de OC (po_item_id) y a los items del goods_receipt si corresponde."));
children.push(numList("Estado RECEIVED → VALIDATED al verificar contra OC y recepción. Al pagar al proveedor, status PAID y se registra payment_date."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 5. INVENTARIO
// ================================================================
children.push(h1("5. Inventario"));
children.push(pBold("Principio rector: inventory_movements es la única fuente de verdad."));
children.push(p("Toda variación de stock genera una fila en inventory_movements. El stock actual de un SKU se calcula como SUM(quantity_in) - SUM(quantity_out) — implementado en la vista v_inventory_current. No existen tablas paralelas que mantengan el saldo (lo que en el sistema viejo causaba divergencias entre 'Gestión de Inventario', 'Bitácora' y los detalles)."));

children.push(h2("5.1 Tipos de movimiento"));
children.push(makeTable([
  ["Tipo", "Sentido", "Origen típico"],
  ["RECEIPT", "Entrada", "goods_receipt_items (recepción de OC)"],
  ["ISSUE", "Salida", "order_items (empacado de pedido cliente)"],
  ["ADJUSTMENT_IN", "Entrada", "non_conformities tipo IN, conteos físicos"],
  ["ADJUSTMENT_OUT", "Salida", "non_conformities tipo OUT, mermas"],
  ["RETURN_IN", "Entrada", "Devolución de cliente"],
  ["RETURN_OUT", "Salida", "Devolución a proveedor"],
  ["OPENING_BALANCE", "Entrada", "Saldo inicial al migrar de Notion"]
], [2400, 1800, 5160]));

children.push(h2("5.2 Valuación"));
children.push(p("Se usa costo promedio ponderado: cada RECEIPT registra su unit_cost, y v_inventory_current calcula avg_unit_cost = SUM(qty_in × cost) / SUM(qty_in). Las salidas (ISSUE) toman este promedio al momento del movimiento, lo que permite cálculo de margen consistente."));

children.push(h2("5.3 KPIs derivados (vista v_inventory_kpis)"));
children.push(bullet("Días sin movimiento: ahora() − última fecha de ISSUE."));
children.push(bullet("Semáforo: GREEN (≤30 días), YELLOW (≤90), ORANGE (≤180), RED (>180), NEVER_SOLD."));
children.push(bullet("Clasificación ABC: A (acumulado ≤80% del valor de demanda 90d), B (≤95%), C (resto)."));
children.push(bullet("Acción sugerida: PURCHASE_URGENT, PURCHASE, LIQUIDATE, REVIEW, NONE — según stock vs mínimo y rotación."));
children.push(bullet("Estos KPIs se reemplazan los campos calculados en Notion y se recalculan en cada consulta a la vista, sin tareas programadas."));

children.push(h2("5.4 Cierres mensuales (inventory_snapshots)"));
children.push(p("Al final de cada mes, un job programa una inserción en inventory_snapshots con la cantidad y el costo promedio de cada SKU. Esta tabla es inmutable y sirve para reportes históricos de valor de inventario y comparativas anuales (reemplaza 'Crecimiento de Inventario')."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 6. DEVOLUCIONES Y NOTAS DE CRÉDITO
// ================================================================
children.push(h1("6. Devoluciones y notas de crédito"));

children.push(h2("6.1 Devolución de cliente"));
children.push(numList("El cliente devuelve material, total o parcialmente, sobre una orden ya entregada."));
children.push(numList("Se registra un inventory_movement tipo RETURN_IN por la cantidad devuelta — el inventario sube."));
children.push(numList("Si la orden ya fue facturada (CFDI tipo I emitido), se emite un CFDI tipo E (Egreso) en cfdi con el monto a acreditar."));
children.push(numList("Se vincula el CFDI tipo E al CFDI tipo I original mediante cfdi_credit_notes (related_cfdi_id) con el motivo y relation_type apropiado (01 = nota de crédito de los documentos relacionados)."));
children.push(numList("Si el cliente ya pagó, se procesa el reembolso vía payments (con monto negativo o tabla refunds según preferencia operativa) y se ajusta payment_status a PARTIAL o REFUNDED."));

children.push(h2("6.2 Devolución a proveedor"));
children.push(numList("Material defectuoso identificado tras recepción se devuelve al proveedor."));
children.push(numList("Se registra un inventory_movement tipo RETURN_OUT — el inventario baja."));
children.push(numList("Se solicita al proveedor su nota de crédito; al recibirla, se vincula a la supplier_invoice original y se ajusta el saldo a pagar."));

children.push(h2("6.3 No conformes (ajustes internos)"));
children.push(numList("Detectados al recibir o durante un conteo físico. Se crea una non_conformity con producto, factura origen, motivo y tipo de ajuste (IN/OUT)."));
children.push(numList("El trigger genera el inventory_movement correspondiente automáticamente."));
children.push(numList("Se registra responsable, ubicación física temporal y observaciones."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 7. CFDI 4.0
// ================================================================
children.push(h1("7. CFDI 4.0 — Facturación electrónica México"));
children.push(p("El sistema implementa el estándar CFDI 4.0 vigente del SAT. Esto incluye: claves de producto/servicio y unidad SAT, régimen fiscal del emisor y receptor, lugar de expedición (código postal), uso de CFDI, método y forma de pago, complementos de pago (PPD), y notas de crédito (CFDI tipo E)."));

children.push(h2("7.1 Catálogos SAT"));
children.push(p("Se cargan los catálogos oficiales SAT en tablas: sat_product_keys, sat_unit_keys, sat_tax_regimes, sat_cfdi_uses, sat_payment_methods, sat_payment_forms. Estos catálogos se actualizan periódicamente según publica el SAT."));

children.push(h2("7.2 Tipos de CFDI"));
children.push(makeTable([
  ["Tipo", "Nombre", "Uso"],
  ["I", "Ingreso", "Factura de venta normal."],
  ["E", "Egreso", "Nota de crédito (devolución, descuento posterior)."],
  ["P", "Pago", "Complemento de pago — obligatorio cuando el método es PPD."],
  ["N", "Nómina", "Fuera de alcance en este sistema."],
  ["T", "Traslado", "Movimiento sin enajenación. No usado en flujo actual."]
], [1200, 1800, 6360]));

children.push(h2("7.3 PUE vs PPD"));
children.push(bullet("PUE (Pago en Una Exhibición): el cliente paga al recibir o antes de recibir el CFDI. No requiere complemento de pago."));
children.push(bullet("PPD (Pago en Parcialidades o Diferido): el cliente paga después o en partes. Cada pago recibido genera un CFDI tipo P (complemento de pago)."));

children.push(h2("7.4 Cancelación"));
children.push(p("Un CFDI timbrado solo puede cancelarse mediante el proceso del SAT (con o sin aceptación del receptor según monto). El sistema mantiene status DRAFT, TIMBRADO, CANCELLED en la tabla cfdi, y registra cancelled_at y cancellation_reason. El XML cancelado se preserva."));

children.push(h2("7.5 Notas de crédito"));
children.push(p("Se modela como un CFDI tipo E vinculado al CFDI tipo I original vía cfdi_credit_notes (con relation_type 01 según catálogo SAT). El monto se descuenta del saldo y, si aplica, dispara un reembolso."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 8. REGLAS DE CÁLCULO
// ================================================================
children.push(h1("8. Reglas de cálculo"));
children.push(p("Todos los cálculos críticos viven en la base de datos: triggers para totales, vistas para KPIs derivados. No hay fórmulas externas mantenidas en otra capa, lo que elimina el riesgo de divergencia."));

children.push(h2("8.1 Totales por partida (quote_items, order_items)"));
children.push(pItalic("subtotal      = ROUND(qty × unit_price × (1 - discount_pct/100), 4)"));
children.push(pItalic("tax_amount    = ROUND(subtotal × tax_pct/100, 4)"));
children.push(pItalic("total         = subtotal + tax_amount"));
children.push(pItalic("cost_subtotal = qty × unit_cost_purchase   (snapshot al cotizar)"));

children.push(h2("8.2 Totales por documento"));
children.push(pItalic("doc.subtotal      = SUM(item.subtotal)"));
children.push(pItalic("doc.tax_amount    = SUM(item.tax_amount)"));
children.push(pItalic("doc.total         = SUM(item.total) + shipping - discount"));
children.push(pItalic("doc.cost_subtotal = SUM(item.cost_subtotal)"));

children.push(h2("8.3 Costo unitario en recepción (entradas de mercancía)"));
children.push(pItalic("unit_cost = (cantidad_recibida > 0) ? costo_total / cantidad_recibida : 0"));
children.push(p("El trigger valida que cantidad_recibida sea > 0 antes de crear el movimiento."));

children.push(h2("8.4 Margen y reporte de ventas (vista v_sales_report)"));
children.push(pItalic("gross_margin    = order.subtotal - quote.cost_subtotal"));
children.push(pItalic("margin_pct      = gross_margin / order.subtotal × 100"));
children.push(pItalic("difference_vs_po = order.subtotal - quote.subtotal   (cambios post-aprobación)"));
children.push(pItalic("packed_pct      = SUM(qty_packed) / SUM(qty_ordered) × 100"));

children.push(h2("8.5 Stock actual (vista v_inventory_current)"));
children.push(pItalic("quantity_on_hand = SUM(quantity_in) - SUM(quantity_out)"));
children.push(pItalic("avg_unit_cost    = SUM(quantity_in × unit_cost) / SUM(quantity_in)"));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 9. VALIDACIONES Y CONSTRAINTS
// ================================================================
children.push(h1("9. Validaciones y constraints clave"));
children.push(makeTable([
  ["Restricción", "Implementación"],
  ["Cantidades no negativas", "CHECK (qty >= 0) en todas las tablas relevantes"],
  ["Empacado ≤ ordenado", "CHECK (quantity_packed <= quantity_ordered) en order_items"],
  ["Embarcado ≤ empacado", "CHECK (quantity_shipped <= quantity_packed) en order_items"],
  ["Facturado ≤ embarcado", "CHECK (quantity_invoiced <= quantity_shipped) en order_items"],
  ["Recibido ≤ ordenado", "CHECK (quantity_received <= quantity_ordered) en purchase_order_items"],
  ["Movimiento de inventario consistente", "CHECK: qty_in y qty_out son mutuamente excluyentes, y el tipo concuerda"],
  ["Cancelación con motivo", "CHECK en quotes: si status=CANCELLED, debe tener cancellation_reason y cancelled_at"],
  ["Aplicación de pago a algo", "CHECK en payment_applications: cfdi_id IS NOT NULL OR order_id IS NOT NULL"],
  ["Quote → Order 1:1", "UNIQUE (orders.quote_id)"],
  ["UUID CFDI único", "UNIQUE (cfdi.uuid)"],
  ["RFC único por entidad", "UNIQUE (customer_id, rfc) en customer_tax_data"],
  ["Configuración de producto deduplicada", "UNIQUE (product_id, config_hash)"]
], [4200, 5160]));

children.push(h2("9.1 Reglas adicionales en aplicación"));
children.push(bullet("Una cotización no puede pasar a APPROVED si tiene partidas con cantidad 0 o producto inactivo."));
children.push(bullet("No se puede crear un order_item con product_configuration_id que pertenece a otro product_id."));
children.push(bullet("No se puede emitir CFDI sin que el cliente tenga customer_tax_data válido (RFC, régimen, CP)."));
children.push(bullet("No se puede empacar más cantidad que el stock disponible (consultando v_inventory_current)."));
children.push(bullet("Cambios de precio en supplier_products generan una nueva fila con valid_from = hoy y se cierra la anterior con valid_to = hoy - 1, manteniendo histórico."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 10. CASO EXTREMO A EXTREMO
// ================================================================
children.push(h1("10. Caso extremo a extremo (ejemplo)"));
children.push(p("Para ilustrar cómo viajan los datos entre tablas, este es el flujo de una venta típica con su contraparte de compra y facturación, en orden cronológico:"));

children.push(numList("Cliente envía PO. Vendedor crea quote en estado DRAFT, agrega 3 quote_items: dos partes en stock y una máquina configurada (compresor 220V/Rojo)."));
children.push(numList("Trigger calcula subtotal, IVA, total y cost_subtotal de cada partida y consolida en quotes."));
children.push(numList("Vendedor envía cotización al cliente: status SENT. Cliente la aprueba: status APPROVED."));
children.push(numList("Trigger fn_create_order_from_approved_quote crea order y order_items copiando las partidas. Inserta milestone CREATED."));
children.push(numList("Almacén ve que la máquina configurada no está en stock; PURCHASING crea una purchase_request con esa partida."));
children.push(numList("PURCHASING genera purchase_order al proveedor preferido con folio PO-2026-001. Se envía: status SENT. Proveedor confirma: CONFIRMED."));
children.push(numList("Llega la mercancía. WAREHOUSE crea goods_receipt asociado a la OC y a la supplier_invoice del proveedor."));
children.push(numList("Trigger fn_create_inv_movement_from_receipt inserta inventory_movement tipo RECEIPT con cantidad y costo. v_inventory_current refleja stock disponible."));
children.push(numList("Detecta una pieza defectuosa: WAREHOUSE crea non_conformity con adjustment_type OUT. Trigger inserta ADJUSTMENT_OUT, stock baja en consecuencia."));
children.push(numList("Almacén empaca el pedido: actualiza order_items.quantity_packed. Trigger crea inventory_movements tipo ISSUE por cada partida. Stock baja."));
children.push(numList("Order status pasa a READY_TO_SHIP, luego SHIPPED y DELIVERED al confirmar la entrega. Cada hito en order_milestones."));
children.push(numList("ACCOUNTING emite CFDI tipo I: cfdi + cfdi_items con claves SAT, IVA 16%. Método PPD (cliente paga a 30 días). Status TIMBRADO al recibir UUID del PAC."));
children.push(numList("Cliente paga 50% a los 15 días: ACCOUNTING crea payment + payment_applications, y emite cfdi_payment tipo P. order.payment_status = PARTIAL."));
children.push(numList("Cliente paga el resto a los 30 días: nuevo payment, nuevo cfdi_payment. order.payment_status = PAID. Milestone PAID en order_milestones."));
children.push(numList("Reportes: v_sales_report muestra esta venta con su margen y % empacado calculados; v_inventory_kpis refleja la rotación; audit_log tiene el rastro completo."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 11. INTEGRACIONES Y CONSIDERACIONES TÉCNICAS
// ================================================================
children.push(h1("11. Integraciones y consideraciones técnicas"));

children.push(h2("11.1 Integración con PAC"));
children.push(p("La emisión de CFDI requiere un PAC (Proveedor Autorizado de Certificación). Servicios típicos en México: Diverza, Edicom, Solución Factible, Facturama. La integración es vía API REST: enviar XML pre-armado, recibir XML timbrado con UUID y sello SAT."));

children.push(h2("11.2 Pasarela de pago / banca"));
children.push(p("Para conciliación bancaria automática, se puede integrar el estado de cuenta del banco (vía SPEI/CoDi para transferencias) y matchear pagos en payments con su CFDI tipo P correspondiente."));

children.push(h2("11.3 Backups y retención"));
children.push(bullet("Backup completo diario, incremental por hora."));
children.push(bullet("Retención: CFDI ≥ 5 años (requisito SAT). audit_log ≥ 7 años. Snapshots indefinido."));
children.push(bullet("XML y PDF de CFDI almacenados en blob storage (S3, GCS) con referencia desde cfdi.xml_path / pdf_path."));

children.push(h2("11.4 Performance"));
children.push(bullet("Índices en columnas de búsqueda frecuente (ya creados en el DDL)."));
children.push(bullet("Vista v_inventory_kpis es costosa con miles de SKUs — considerar materializarla con refresh nocturno: CREATE MATERIALIZED VIEW + REFRESH MATERIALIZED VIEW CONCURRENTLY."));
children.push(bullet("Particionar inventory_movements por mes si se acumulan millones de registros: PARTITION BY RANGE (occurred_at)."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 12. RESUMEN DE DIFERENCIAS NOTION vs PG
// ================================================================
children.push(h1("12. Diferencias clave vs sistema actual"));
children.push(makeTable([
  ["Aspecto", "Notion + n8n (hoy)", "PostgreSQL (nuevo)"],
  ["Integridad referencial", "Rollups con [0], se pierden datos", "Foreign keys garantizadas"],
  ["Cancelaciones", "Tabla aparte 'Cotizaciones Canceladas'", "Estado en quotes.status"],
  ["Pedidos incompletos", "Tabla duplicada", "Vista v_orders_with_shortage"],
  ["Reporte de ventas", "Tabla espejo manual", "Vista v_sales_report"],
  ["Stock", "3 fuentes paralelas", "1 fuente (movimientos) + vistas"],
  ["Cálculos", "Fórmulas Notion (cambian retroactivo)", "Triggers SQL + vistas (auditables)"],
  ["CFDI 4.0", "Ausente", "Módulo nativo completo"],
  ["Auditoría", "Inexistente", "audit_log con before/after"],
  ["Permisos", "No hay", "RBAC granular"],
  ["Multi-moneda", "Asume MXN", "Currency + exchange_rate explícito"],
  ["Histórico de precios", "Se sobrescribe", "valid_from/valid_to"]
], [2400, 3480, 3480]));

// ================================================================
// FOOTER + GENERATE
// ================================================================

const doc = new Document({
  creator: "Sistema RTB",
  title: "Lógica de Negocio RTB",
  description: "Documento de lógica de negocio para migración Notion → PostgreSQL",
  styles: {
    default: { document: { run: { font: ARIAL, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: ARIAL, color: "1F2937" },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: ARIAL, color: "1F2937" },
        paragraph: { spacing: { before: 240, after: 180 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: ARIAL, color: "374151" },
        paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 2 } }
    ]
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "Sistema RTB · Lógica de negocio", font: ARIAL, size: 18, color: "6B7280" })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Página ", font: ARIAL, size: 18, color: "6B7280" }),
            new TextRun({ children: [PageNumber.CURRENT], font: ARIAL, size: 18, color: "6B7280" })
          ]
        })]
      })
    },
    children
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/sessions/bold-dazzling-brahmagupta/mnt/outputs/rtb/06_logica_negocio.docx", buf);
  console.log("DOCX listo:", buf.length, "bytes");
});

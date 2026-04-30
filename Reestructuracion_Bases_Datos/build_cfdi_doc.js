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
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((row, idx) => new TableRow({ tableHeader: idx === 0,
      children: row.map((cell, ci) => new TableCell({
        borders, width: { size: widths[ci], type: WidthType.DXA },
        shading: idx === 0 ? { fill: DARK, type: ShadingType.CLEAR } : undefined,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({
          text: String(cell), font: ARIAL, size: 20, bold: idx === 0,
          color: idx === 0 ? "FFFFFF" : DARK })] })] }))
    }))
  });
}
const ch = [];

// Portada
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 240 },
  children: [new TextRun({ text: "Módulo de", font: ARIAL, size: 56, bold: true })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
  children: [new TextRun({ text: "Facturación CFDI 4.0", font: ARIAL, size: 56, bold: true })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360, after: 120 },
  children: [new TextRun({ text: "Sistema RTB · SAT México", font: ARIAL, size: 28, color: GRAY })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "Tipos I/E/P · Timbrado PAC · Complementos PPD · Notas crédito · Cancelación", font: ARIAL, size: 18, color: GRAY })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 },
  children: [new TextRun({ text: "Documento de diseño y operación · v1.0", font: ARIAL, size: 22, color: GRAY })] }));
ch.push(new Paragraph({ children: [new PageBreak()] }));

// 1. INTRO
ch.push(h1("1. Introducción"));
ch.push(p("Este documento describe el módulo de Facturación Electrónica del sistema RTB, basado en el estándar CFDI 4.0 vigente del SAT en México. Cubre: configuración del emisor, manejo de series y folios, ciclo de timbrado con el PAC, complementos de pago para PPD, notas de crédito tipo E, cancelación y reexpedición, así como el manejo de gastos operativos."));

ch.push(h2("1.1 Tablas del módulo"));
ch.push(makeTable([
  ["Tabla","Propósito"],
  ["cfdi","Cabecera del comprobante (todos los tipos: I, E, P, T)"],
  ["cfdi_items","Conceptos del comprobante con claves SAT y impuestos"],
  ["cfdi_credit_notes","Notas de crédito (CFDI tipo E vinculado a tipo I)"],
  ["cfdi_payments","Complementos de pago (CFDI tipo P para PPD)"],
  ["cfdi_issuer_config","Datos fiscales y credenciales del emisor (RTB)"],
  ["cfdi_series","Series y folios consecutivos"],
  ["cfdi_pac_log","Bitácora de operaciones con el PAC"],
  ["payments","Pagos recibidos del cliente"],
  ["payment_applications","Aplicación de pagos a CFDIs / orders (N:N)"],
  ["operating_expenses","Gastos no inventariables (con CFDI del proveedor)"]
], [3000, 6360]));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 2. TIPOS DE CFDI
ch.push(h1("2. Tipos de CFDI 4.0"));
ch.push(makeTable([
  ["Tipo","Nombre","Uso"],
  ["I","Ingreso","Factura de venta normal — cobras al cliente"],
  ["E","Egreso","Nota de crédito por devolución, descuento posterior, error de monto"],
  ["P","Pago","Complemento de pago — obligatorio cuando una factura I es PPD"],
  ["T","Traslado","Movimiento de mercancía sin venta (carta porte) — fuera de alcance"],
  ["N","Nómina","Recibo de nómina — fuera de alcance"]
], [800, 1700, 6860]));

ch.push(h2("2.1 PUE vs PPD (método de pago)"));
ch.push(makeTable([
  ["Método","Significado","Complemento"],
  ["PUE","Pago en Una Exhibición — el cliente paga al recibir la factura o antes","No requiere complemento"],
  ["PPD","Pago en Parcialidades o Diferido — el cliente paga después o en parcialidades","Cada pago genera un CFDI tipo P"]
], [1000, 5000, 3360]));

ch.push(h2("2.2 Forma de pago vs Método de pago"));
ch.push(p("Importante: son dos cosas distintas en el SAT."));
ch.push(makeTable([
  ["Concepto","Catálogo SAT","Pregunta que responde"],
  ["Forma de pago","c_FormaPago","¿CÓMO se pagó? (efectivo, transferencia, tarjeta…)"],
  ["Método de pago","c_MetodoPago","¿CUÁNDO se pagó? (de una vez = PUE / a plazos = PPD)"]
], [2000, 2200, 5160]));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 3. CONFIGURACIÓN DEL EMISOR
ch.push(h1("3. Configuración del emisor (cfdi_issuer_config)"));
ch.push(p("Antes de emitir el primer CFDI, hay que registrar los datos fiscales y credenciales de la empresa emisora (RTB)."));

ch.push(h2("3.1 Estructura"));
ch.push(code(
`CREATE TABLE cfdi_issuer_config (
    config_id              BIGINT PK,
    rfc                    CITEXT NOT NULL,
    legal_name             TEXT NOT NULL,
    tax_regime_id          SMALLINT FK sat_tax_regimes,    -- 601, 612, etc.
    zip_code               TEXT NOT NULL,                  -- domicilio fiscal
    place_of_issue_zip     TEXT NOT NULL,                  -- LugarExpedicion
    -- CSD: Certificado de Sello Digital (lo emite el SAT)
    csd_certificate_path   TEXT,
    csd_key_path           TEXT,
    csd_password_encrypted TEXT,
    csd_serial_number      TEXT,
    csd_valid_from, csd_valid_to,
    -- PAC: Proveedor Autorizado de Certificación
    pac_provider           TEXT,                           -- 'Diverza', 'Edicom', 'Facturama'
    pac_username           TEXT,
    pac_endpoint_url       TEXT,
    pac_credentials_encrypted TEXT,
    pac_environment        TEXT (SANDBOX|PRODUCTION),
    is_active              BOOLEAN,
    valid_from, valid_to
);`));

ch.push(h2("3.2 ¿Por qué tener varios configs?"));
ch.push(bullet("Cuando renueves el CSD (cada 4 años), abres un config nuevo y cierras el anterior."));
ch.push(bullet("Si cambias de PAC, otro config nuevo (los CFDIs viejos quedan vinculados al config con el PAC anterior)."));
ch.push(bullet("Si tu RFC cambia (raro), histórico se preserva."));

ch.push(h2("3.3 Seguridad de credenciales"));
ch.push(bullet("NUNCA guardar contraseñas en claro: usar AWS KMS, HashiCorp Vault, o pgcrypto.symkey()."));
ch.push(bullet("El .key del CSD se almacena encriptado; la contraseña en gestor de secretos."));
ch.push(bullet("Solo rol con permiso 'cfdi.config.manage' puede ver/editar."));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 4. SERIES Y FOLIOS
ch.push(h1("4. Series y folios (cfdi_series)"));

ch.push(h2("4.1 Estructura"));
ch.push(code(
`CREATE TABLE cfdi_series (
    series_id    BIGINT PK,
    series       TEXT UNIQUE,                    -- 'A', 'NC', 'CP', 'EXP'
    cfdi_type    CHAR(1) (I|E|P|T),
    description  TEXT,
    next_folio   BIGINT NOT NULL DEFAULT 1,
    is_active    BOOLEAN
);`));

ch.push(h2("4.2 Series sugeridas para RTB"));
ch.push(makeTable([
  ["series","cfdi_type","Uso"],
  ["A","I","Factura de venta normal (Ingreso)"],
  ["NC","E","Notas de crédito (Egreso) — devoluciones, descuentos posteriores"],
  ["CP","P","Complementos de pago (PPD)"],
  ["EXP","I","Facturas de exportación (si aplica)"]
], [1200, 1500, 6660]));

ch.push(h2("4.3 fn_assign_cfdi_folio (asignación atómica)"));
ch.push(p("Para evitar folios duplicados en concurrencia (dos vendedores facturan al mismo segundo), la función bloquea la fila con FOR UPDATE:"));
ch.push(code(
`SELECT out_series_id, out_folio FROM fn_assign_cfdi_folio('A');
-- Devuelve: series_id, next_folio (ej. 12345)
-- Y atómicamente actualiza next_folio = 12346 para la siguiente llamada`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 5. FLUJO DE TIMBRADO
ch.push(h1("5. Flujo de timbrado de un CFDI tipo I"));

ch.push(h2("5.1 Pasos completos"));
ch.push(numList("Validar que la orden (orders) esté lista para facturar (status DELIVERED o equivalente)."));
ch.push(numList("Llamar fn_assign_cfdi_folio('A') para reservar serie + folio."));
ch.push(numList("Crear fila en cfdi con status = DRAFT y todos los snapshots fiscales (emisor + receptor)."));
ch.push(numList("Crear filas en cfdi_items con claves SAT producto/unidad e impuestos por concepto."));
ch.push(numList("Generar el XML según estándar SAT 4.0 (XSLT o templates de la app)."));
ch.push(numList("Sellar el XML con el CSD del emisor (firma criptográfica)."));
ch.push(numList("Enviar el XML al PAC vía API REST."));
ch.push(numList("PAC valida estructura, RFCs, claves SAT, sellos, etc."));
ch.push(numList("Si OK: PAC devuelve UUID, sello SAT, certificate_number SAT, fecha de timbre."));
ch.push(numList("Actualizar cfdi.status = TIMBRADO, guardar UUID, sello, timbre_date, xml_path."));
ch.push(numList("Registrar el intento en cfdi_pac_log (success=TRUE, uuid_received=...)."));
ch.push(numList("Generar PDF de la factura para el cliente."));

ch.push(h2("5.2 Si el PAC rechaza"));
ch.push(numList("Registrar en cfdi_pac_log con success=FALSE y error_code/error_message."));
ch.push(numList("cfdi.status sigue siendo DRAFT."));
ch.push(numList("Mostrar al usuario el error para corregir (RFC mal escrito, clave SAT inválida, etc.)."));
ch.push(numList("Reintentar (incrementa attempt_number en pac_log)."));

ch.push(h2("5.3 SQL del flujo"));
ch.push(code(
`-- 1. Reservar folio
SELECT * FROM fn_assign_cfdi_folio('A');

-- 2. Insertar cabecera CFDI con snapshots
INSERT INTO cfdi (
    cfdi_type, series_id, folio, customer_id, customer_tax_data_id,
    issuer_rfc, issuer_legal_name, issuer_tax_regime_id, issuer_zip_code,
    receiver_rfc, receiver_legal_name, receiver_tax_regime_id, receiver_zip_code,
    cfdi_use_id, payment_method_id, payment_form_id,
    place_of_issue_zip,
    subtotal, tax_amount, total,
    issuer_config_id,
    status
) VALUES (
    'I', series_id, 12345, customer_id, customer_tax_data_id,
    'RTB850101AB7', 'RTB Industrial S.A. de C.V.', 601, '64000',
    'FEM850412IT5', 'Femsa Comercial', 601, '64000',
    'G01', 'PPD', NULL,                    -- forma=NULL para PPD
    '64000',
    44660, 6160, 50820,
    issuer_config_id,
    'DRAFT'
);

-- 3. Insertar conceptos
INSERT INTO cfdi_items (cfdi_id, line_number, sat_product_key_id, sat_unit_id,
                        product_id, sku, description, quantity, unit_price,
                        subtotal, iva_pct, iva_amount, total) VALUES (...);

-- 4. La app genera XML, lo sella, lo envía al PAC
-- 5. Recibida la respuesta:
UPDATE cfdi SET
    status = 'TIMBRADO',
    uuid = 'A1B2-...-9876',
    sello_cfdi = '...',
    sello_sat = '...',
    certificate_number = '...',
    sat_certificate_no = '...',
    timbre_date = '2026-04-25 10:30',
    xml_path = '/storage/cfdi/2026/04/uuid.xml',
    pdf_path = '/storage/cfdi/2026/04/uuid.pdf'
WHERE cfdi_id = ...;

-- 6. Bitácora
INSERT INTO cfdi_pac_log (cfdi_id, operation, success, uuid_received, ...)
VALUES (cfdi_id, 'TIMBRAR', TRUE, 'A1B2-...-9876', ...);`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 6. PPD Y COMPLEMENTOS
ch.push(h1("6. CFDI PPD y complementos de pago"));

ch.push(h2("6.1 Contexto"));
ch.push(p("Cuando emites una factura tipo I con payment_method='PPD', estás declarando que el cliente pagará después o a parcialidades. Por cada pago que recibas, debes emitir un CFDI tipo P (complemento de pago) que reporta la transacción al SAT."));

ch.push(h2("6.2 Flujo"));
ch.push(numList("Se emite CFDI A001 tipo I PPD por $100,000."));
ch.push(numList("Cliente paga $40,000 el 15 de marzo. Se registra payment + payment_application."));
ch.push(numList("Se emite CFDI tipo P (complemento) que reporta este pago, vinculado a A001."));
ch.push(numList("Cliente paga $60,000 el 30 de abril. Otro payment + complemento."));
ch.push(numList("Cuando suma de complementos = $100,000, el saldo es 0 y la factura queda PAID."));

ch.push(h2("6.3 cfdi_payments (estructura del complemento)"));
ch.push(code(
`CREATE TABLE cfdi_payments (
    cfdi_payment_id     BIGINT PK,
    payment_cfdi_id     BIGINT FK cfdi,           -- el CFDI tipo P
    related_cfdi_id     BIGINT FK cfdi,           -- el CFDI tipo I que se está pagando
    payment_date        TIMESTAMPTZ,
    payment_form_id     TEXT FK sat_payment_forms (01, 03...),
    currency, exchange_rate,
    payment_amount      NUMERIC,
    partiality_number   SMALLINT (1, 2, 3...),
    previous_balance    NUMERIC,                  -- saldo antes de este pago
    paid_amount         NUMERIC,                  -- monto del pago
    remaining_balance   NUMERIC                   -- saldo después
);`));

ch.push(h2("6.4 Vista v_cfdi_ppd_pending_payment"));
ch.push(code(
`SELECT * FROM v_cfdi_ppd_pending_payment;
-- uuid, series, folio, customer, total, paid, remaining, days_since_issue
-- Sirve para cobranza: muestra qué facturas siguen sin saldar y desde cuándo`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 7. NOTAS DE CRÉDITO
ch.push(h1("7. Notas de crédito (CFDI tipo E)"));

ch.push(h2("7.1 Cuándo emitir tipo E"));
ch.push(bullet("Cliente devuelve mercancía después de facturada."));
ch.push(bullet("Se aplica un descuento posterior a la emisión."));
ch.push(bullet("Error en monto facturado (más cobrado de lo correcto)."));
ch.push(bullet("Bonificación al cliente."));

ch.push(h2("7.2 Estructura de cfdi_credit_notes"));
ch.push(code(
`CREATE TABLE cfdi_credit_notes (
    credit_note_id   BIGINT PK,
    credit_cfdi_id   BIGINT FK cfdi,    -- el CFDI tipo E (UNIQUE: una NC = un CFDI E)
    related_cfdi_id  BIGINT FK cfdi,    -- el CFDI tipo I que afecta
    relation_type    TEXT (01-07),       -- catálogo SAT c_TipoRelacion
    reason           TEXT NOT NULL,
    refund_amount    NUMERIC NOT NULL CHECK (refund_amount > 0)
);`));

ch.push(h2("7.3 Tipos de relación SAT (c_TipoRelacion)"));
ch.push(makeTable([
  ["Código","Significado"],
  ["01","Nota de crédito de los documentos relacionados"],
  ["02","Nota de débito de los documentos relacionados"],
  ["03","Devolución de mercancía sobre facturas previas"],
  ["04","Sustitución de los CFDIs previos"],
  ["05","Traslados de mercancías facturados previamente"],
  ["06","Factura generada por traslados previos"],
  ["07","CFDI por aplicación de anticipo"]
], [1200, 8160]));

ch.push(h2("7.4 Flujo"));
ch.push(numList("Crear CFDI tipo E con datos fiscales completos (mismo cliente, RFC, etc.)."));
ch.push(numList("Crear cfdi_credit_notes vinculando con related_cfdi_id (el original) y relation_type."));
ch.push(numList("Sellar y timbrar normalmente con el PAC."));
ch.push(numList("Si aplica reembolso, crear payment con monto negativo o registrar la devolución en payments."));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 8. CANCELACIÓN
ch.push(h1("8. Cancelación de CFDI"));

ch.push(h2("8.1 Motivos SAT"));
ch.push(makeTable([
  ["Motivo","Significado","Requiere CFDI sustituto"],
  ["01","Comprobante con errores con relación","Sí"],
  ["02","Comprobante con errores sin relación","No"],
  ["03","No se llevó a cabo la operación","No"],
  ["04","Operación nominativa relacionada en factura global","No"]
], [1500, 4500, 3360]));

ch.push(h2("8.2 Flujo de cancelación con sustitución (motivo 01)"));
ch.push(numList("Detectar el error en CFDI A (uuid: AAA...111)."));
ch.push(numList("Crear CFDI B con datos correctos. CFDI B.replaces_cfdi_id = A.cfdi_id."));
ch.push(numList("Timbrar B → recibe nuevo UUID (BBB...222)."));
ch.push(numList("Solicitar cancelación de A al SAT (vía PAC), motivo 01, sustituto = BBB...222."));
ch.push(numList("SAT puede requerir aceptación del receptor (si monto > $1,000 + algunas reglas)."));
ch.push(numList("Cuando SAT confirma cancelación: A.status = CANCELLED, A.replaced_by_cfdi_id = B.cfdi_id."));

ch.push(h2("8.3 Vista v_cfdi_cancellations"));
ch.push(code(
`SELECT cancelled_uuid, replacement_uuid, sat_cancellation_motive, cancelled_at
FROM v_cfdi_cancellations
WHERE cancelled_at >= now() - INTERVAL '30 days';`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 9. BITÁCORA PAC
ch.push(h1("9. Bitácora de operaciones con PAC (cfdi_pac_log)"));

ch.push(p("Cada interacción con el PAC se registra. Sirve para auditoría y debugging."));

ch.push(h2("9.1 Estructura"));
ch.push(code(
`CREATE TABLE cfdi_pac_log (
    log_id           BIGINT PK,
    cfdi_id          BIGINT FK cfdi,
    operation        TEXT (TIMBRAR | CANCELAR | CONSULTAR_ESTATUS | REPROCESAR),
    attempt_number   SMALLINT,
    attempt_at       TIMESTAMPTZ,
    pac_provider     TEXT,
    request_payload  TEXT,                 -- XML enviado
    response_payload TEXT,                 -- respuesta XML/JSON del PAC
    success          BOOLEAN,
    error_code       TEXT,
    error_message    TEXT,
    uuid_received    TEXT,
    sello_sat        TEXT,
    user_id          BIGINT FK
);`));

ch.push(h2("9.2 Casos de uso"));
ch.push(bullet("Debugging: '¿por qué falló el timbrado de la factura X?' → ver request/response."));
ch.push(bullet("Auditoría: '¿quién canceló esta factura y cuándo?'"));
ch.push(bullet("Reintentos: si el PAC tiene caído el servicio, los intentos se acumulan en attempt_number."));
ch.push(bullet("Métricas: tasa de éxito de timbrado, tiempo promedio de respuesta del PAC."));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 10. GASTOS OPERATIVOS
ch.push(h1("10. Gastos operativos (operating_expenses)"));

ch.push(p("Tabla independiente para gastos no inventariables. NO emite CFDI (los CFDIs los emite el proveedor a tu favor), pero registra los datos para deducción."));

ch.push(h2("10.1 Estructura"));
ch.push(code(
`CREATE TABLE operating_expenses (
    expense_id            BIGINT PK,
    expense_number        TEXT,
    supplier_id           BIGINT FK suppliers (puede ser NULL si ocasional),
    supplier_rfc          CITEXT,                          -- snapshot
    concept               TEXT NOT NULL,
    category              TEXT NOT NULL,                   -- Servicios, Viáticos, Fijos
    expense_date          DATE NOT NULL,
    invoice_folio         TEXT,                            -- folio del CFDI del proveedor
    uuid_sat              TEXT,                            -- UUID del CFDI recibido
    is_deductible         BOOLEAN,
    sat_payment_form_id   TEXT FK sat_payment_forms,
    sat_payment_method_id TEXT FK sat_payment_methods,
    is_credit             BOOLEAN GENERATED (sat_payment_method_id = 'PPD'),
    status                TEXT (PENDING, PAID, CANCELLED),
    responsible_user_id   BIGINT FK users,
    subtotal, tax_amount, total,
    notes
);`));

ch.push(h2("10.2 Diferencia con factura de proveedor"));
ch.push(makeTable([
  ["Aspecto","supplier_invoices","operating_expenses"],
  ["Origen","Compra con PR/PO","Gasto directo (renta, luz, viáticos)"],
  ["Inventario","Sí (genera goods_receipts)","No"],
  ["PR/PO requerido","Sí","No"],
  ["Trigger cadena estricta","Sí","No"],
  ["Categoría","item_type (RESALE/INTERNAL/SERVICE)","category (Servicios, Viáticos, Fijos…)"]
], [2200, 3500, 3660]));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 11. INTEGRACIÓN PAC
ch.push(h1("11. Integración con PAC (Proveedor Autorizado de Certificación)"));

ch.push(p("El PAC es un proveedor externo certificado por el SAT. Su función:"));
ch.push(bullet("Validar la estructura del XML."));
ch.push(bullet("Validar firmas digitales y certificados CSD."));
ch.push(bullet("Asignar el UUID fiscal."));
ch.push(bullet("Sellar el XML con el sello SAT."));
ch.push(bullet("Reportar el CFDI al SAT."));

ch.push(h2("11.1 PACs comunes en México"));
ch.push(bullet("Diverza"));
ch.push(bullet("Edicom"));
ch.push(bullet("Solución Factible"));
ch.push(bullet("Facturama"));
ch.push(bullet("Konesh"));
ch.push(bullet("Buzón Fiscal"));

ch.push(h2("11.2 Costos típicos"));
ch.push(p("La mayoría cobra por timbres (≈ $1-3 MXN por CFDI timbrado, en paquetes). Algunos ofrecen API REST simple, otros SOAP. Para RTB, recomendable Facturama o Diverza por simplicidad de API."));

ch.push(h2("11.3 Flujo de integración"));
ch.push(code(
`Sistema RTB                         PAC                       SAT
    │                                 │                         │
    ├── POST /timbrar (XML sellado) ─►│                         │
    │                                 ├── valida estructura     │
    │                                 ├── envía a SAT ─────────►│
    │                                 │                         ├ valida
    │                                 │◄──── UUID + sello SAT ──┤
    │                                 │                         │
    │◄── XML timbrado + UUID ─────────┤                         │
    │                                 │                         │
    ├── INSERT cfdi_pac_log success=TRUE                        │
    └── UPDATE cfdi status='TIMBRADO'                           │`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 12. CONSULTAS COMUNES
ch.push(h1("12. Consultas comunes"));

ch.push(h3("Resumen de facturación del mes"));
ch.push(code(
`SELECT * FROM v_cfdi_summary_by_period
WHERE year = 2026 AND month = 4
ORDER BY cfdi_type, status;`));

ch.push(h3("Facturas por cobrar"));
ch.push(code(
`SELECT customer, total, paid, remaining, days_since_issue
FROM v_cfdi_ppd_pending_payment
WHERE remaining > 0
ORDER BY days_since_issue DESC;`));

ch.push(h3("Pagos sin aplicar"));
ch.push(code(
`SELECT * FROM v_payments_unapplied
ORDER BY payment_date;`));

ch.push(h3("Factura X y todos sus complementos de pago"));
ch.push(code(
`SELECT cp.payment_date, cp.payment_amount, cp.partiality_number,
       cp.previous_balance, cp.paid_amount, cp.remaining_balance
FROM cfdi_payments cp
JOIN cfdi c ON c.cfdi_id = cp.related_cfdi_id
WHERE c.uuid = 'AAA-...-111'
ORDER BY cp.partiality_number;`));

ch.push(h3("Histórico de cancelaciones del mes"));
ch.push(code(
`SELECT cancelled_uuid, sat_cancellation_motive, replacement_uuid, cancelled_at
FROM v_cfdi_cancellations
WHERE cancelled_at >= DATE_TRUNC('month', CURRENT_DATE);`));

ch.push(h3("Tasa de éxito de timbrado (últimos 30 días)"));
ch.push(code(
`SELECT
    COUNT(*) AS total_intentos,
    COUNT(*) FILTER (WHERE success) AS exitosos,
    COUNT(*) FILTER (WHERE NOT success) AS fallidos,
    ROUND(COUNT(*) FILTER (WHERE success)::NUMERIC / COUNT(*) * 100, 2) AS exito_pct
FROM cfdi_pac_log
WHERE operation = 'TIMBRAR' AND attempt_at >= now() - INTERVAL '30 days';`));

const doc = new Document({
  creator: "Sistema RTB", title: "Módulo de Facturación CFDI 4.0",
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
      children: [new TextRun({ text: "RTB · CFDI 4.0", font: ARIAL, size: 18, color: GRAY })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Página ", font: ARIAL, size: 18, color: GRAY }),
                 new TextRun({ children: [PageNumber.CURRENT], font: ARIAL, size: 18, color: GRAY })] })] }) },
    children: ch
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/sessions/bold-dazzling-brahmagupta/mnt/outputs/rtb/14_modulo_cfdi.docx", buf);
  console.log("DOCX listo:", buf.length, "bytes");
});

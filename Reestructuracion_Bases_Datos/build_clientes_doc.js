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

// PORTADA
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 240 },
  children: [new TextRun({ text: "Módulo de", font: ARIAL, size: 56, bold: true })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
  children: [new TextRun({ text: "Clientes y Proveedores", font: ARIAL, size: 56, bold: true })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360, after: 120 },
  children: [new TextRun({ text: "Sistema RTB · PostgreSQL", font: ARIAL, size: 28, color: GRAY })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 },
  children: [new TextRun({ text: "Documento de diseño y operación · v1.0", font: ARIAL, size: 22, color: GRAY })] }));
ch.push(new Paragraph({ children: [new PageBreak()] }));

// 1. INTRO
ch.push(h1("1. Introducción"));
ch.push(p("Este documento describe el módulo de Clientes y Proveedores del sistema RTB. Sustituye el \"Directorio de Ubicaciones\" único de Notion por dos modelos separados (clientes y proveedores) con datos fiscales, direcciones múltiples y contactos por rol."));

ch.push(h2("1.1 Por qué se separan clientes y proveedores"));
ch.push(bullet("Los procesos son distintos: a clientes se les vende, a proveedores se les compra."));
ch.push(bullet("Los datos relevantes son distintos: cliente tiene crédito, uso CFDI; proveedor tiene lead time, MOQ."));
ch.push(bullet("Los permisos son distintos: SALES no debe modificar proveedores, PURCHASING no debe modificar clientes."));
ch.push(bullet("El sistema viejo arrastra un bug: raz_n_social mapeado a Dirección. Separar permite limpiarlo."));

ch.push(h2("1.2 Tablas del módulo"));
ch.push(makeTable([
  ["Lado","Tabla","Propósito"],
  ["CLIENTES","customers","Cabecera comercial del cliente."],
  ["","customer_tax_data","RFC, razón social, régimen, uso CFDI. 1:N para multi-sucursal."],
  ["","customer_addresses","Direcciones FISCAL / DELIVERY / OTHER."],
  ["","customer_contacts","Personas de contacto por rol (comprador, tesorería, técnico)."],
  ["PROVEEDORES","suppliers","Cabecera comercial del proveedor (con flag is_occasional, locality)."],
  ["","supplier_tax_data","RFC y razón social del proveedor."],
  ["","supplier_addresses","FISCAL / PICKUP / OTHER."],
  ["","supplier_contacts","Contactos del proveedor."],
  ["","supplier_products","Catálogo: qué SKUs vende cada proveedor con precio histórico."]
], [1500, 2400, 5460]));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 2. CLIENTES
ch.push(h1("2. Lado clientes"));

ch.push(h2("2.1 customers"));
ch.push(pBold("Cabecera del cliente. Datos comerciales, no fiscales."));
ch.push(code(
`CREATE TABLE customers (
    customer_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code               TEXT NOT NULL UNIQUE,
    business_name      TEXT NOT NULL,
    customer_type      TEXT NOT NULL DEFAULT 'COMPANY' CHECK (customer_type IN ('COMPANY','PERSON')),
    locality           TEXT NOT NULL DEFAULT 'LOCAL'   CHECK (locality IN ('LOCAL','FOREIGN')),
    payment_terms_days SMALLINT NOT NULL DEFAULT 0,
    credit_limit       NUMERIC(14,2),
    currency           CHAR(3) NOT NULL DEFAULT 'MXN',
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);`));
ch.push(makeTable([
  ["Campo","Notas"],
  ["code","Identificador interno corto: 'BIMBO', 'FEMSA'. Reemplaza Siglas/ID del Notion viejo."],
  ["business_name","Nombre comercial. La razón social fiscal va en customer_tax_data."],
  ["customer_type","COMPANY (persona moral) o PERSON (persona física)."],
  ["locality","LOCAL = mismo estado/zona. FOREIGN = foráneo. Afecta logística, fletes, retenciones."],
  ["payment_terms_days","Días de crédito por default. 0 = contado. Heredado por cotizaciones."],
  ["credit_limit","Límite máximo de saldo pendiente. Para alertas al cotizar."],
  ["is_active","Para baja sin perder histórico (NUNCA DELETE)."]
], [2200, 7160]));

ch.push(h2("2.2 customer_tax_data — multi-sucursal y multi-RFC"));
ch.push(pBold("Un cliente puede tener varias razones sociales (sucursales con RFCs distintos)."));
ch.push(code(
`CREATE TABLE customer_tax_data (
    tax_data_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    rfc             CITEXT NOT NULL,
    legal_name      TEXT NOT NULL,
    tax_regime_id   SMALLINT REFERENCES sat_tax_regimes(regime_id),
    cfdi_use_id     TEXT REFERENCES sat_cfdi_uses(use_id),
    zip_code        TEXT NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (customer_id, rfc)
);`));
ch.push(p("Caso típico: el cliente Femsa tiene 3 razones sociales — Coca-Cola Femsa, Femsa Comercio, Femsa Logística. Cada CFDI se emite a una de ellas."));
ch.push(makeTable([
  ["Campo","Notas"],
  ["rfc","CITEXT (case-insensitive). UNIQUE por cliente para evitar duplicados."],
  ["legal_name","Razón social fiscal SAT EXACTA. Aquí es donde se corrige el bug 'raz_n_social → Dirección'."],
  ["tax_regime_id","Régimen fiscal SAT (601, 612, 626…)."],
  ["cfdi_use_id","Uso CFDI por defecto al facturar a este RFC (G01, G03…)."],
  ["zip_code","CP del domicilio fiscal. Requerido en CFDI 4.0."],
  ["is_default","Cuál RFC se sugiere por default al cotizar."]
], [2200, 7160]));

ch.push(h2("2.3 customer_addresses — FISCAL y DELIVERY"));
ch.push(p("Dos tipos principales de direcciones para clientes:"));
ch.push(bullet("FISCAL: domicilio físico correspondiente a un RFC. Vinculada con tax_data_id al RFC específico. Cada RFC tiene su dirección fiscal."));
ch.push(bullet("DELIVERY: local, sucursal, planta o CEDIS donde se entrega físicamente. NO requiere tax_data_id. Un cliente puede tener varias."));
ch.push(bullet("OTHER: usos libres (ej. dirección de cobranza si difiere)."));
ch.push(code(
`CREATE TABLE customer_addresses (
    address_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    address_type    TEXT NOT NULL CHECK (address_type IN ('FISCAL','DELIVERY','OTHER')),
    tax_data_id     BIGINT REFERENCES customer_tax_data(tax_data_id),
    label           TEXT,
    street          TEXT NOT NULL,
    exterior_number TEXT,
    interior_number TEXT,
    neighborhood    TEXT, city TEXT, state TEXT,
    country         TEXT NOT NULL DEFAULT 'México',
    zip_code        TEXT,
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK (
        (address_type = 'FISCAL' AND tax_data_id IS NOT NULL)
        OR (address_type <> 'FISCAL' AND tax_data_id IS NULL)
    )
);`));
ch.push(p("El CHECK constraint garantiza la regla: si es FISCAL, debe estar ligada a un RFC; si es DELIVERY u OTHER, tax_data_id queda NULL."));

ch.push(h3("Ejemplo: Cliente con 3 RFCs y múltiples puntos de entrega"));
ch.push(makeTable([
  ["address_type","tax_data_id","label","Descripción"],
  ["FISCAL","1","","Dirección de la matriz Femsa S.A. (ligada a RFC 1)"],
  ["FISCAL","2","","Dirección de Coca-Cola Femsa (ligada a RFC 2)"],
  ["FISCAL","3","","Dirección de Femsa Comercio (ligada a RFC 3)"],
  ["DELIVERY","NULL","Planta Vallejo","Donde se entregan compresores"],
  ["DELIVERY","NULL","CEDIS Norte","Refacciones para CEDIS Norte"],
  ["DELIVERY","NULL","CEDIS Sur","Refacciones para CEDIS Sur"]
], [1700, 1500, 2200, 3960]));

ch.push(h2("2.4 customer_contacts"));
ch.push(p("Personas con quienes el equipo de ventas habla. Es N por cliente — comúnmente hay un comprador, un de tesorería, un técnico."));
ch.push(code(
`CREATE TABLE customer_contacts (
    contact_id    BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    customer_id   BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    full_name     TEXT NOT NULL,
    role_title    TEXT,        -- 'Comprador', 'Tesorería', 'Técnico'
    email         CITEXT,
    phone         TEXT,
    is_primary    BOOLEAN NOT NULL DEFAULT FALSE
);`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 3. PROVEEDORES
ch.push(h1("3. Lado proveedores"));

ch.push(h2("3.1 suppliers"));
ch.push(pBold("Cabecera del proveedor. Misma estructura que customers, con campos específicos."));
ch.push(code(
`CREATE TABLE suppliers (
    supplier_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                   TEXT NOT NULL UNIQUE,
    business_name          TEXT NOT NULL,
    supplier_type          TEXT NOT NULL DEFAULT 'GOODS' CHECK (supplier_type IN ('GOODS','SERVICES','BOTH')),
    locality               TEXT NOT NULL DEFAULT 'LOCAL'  CHECK (locality IN ('LOCAL','FOREIGN')),
    is_occasional          BOOLEAN NOT NULL DEFAULT FALSE,
    payment_terms_days     SMALLINT NOT NULL DEFAULT 0,
    avg_payment_time_days  SMALLINT,
    currency               CHAR(3) NOT NULL DEFAULT 'MXN',
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    notes                  TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);`));
ch.push(makeTable([
  ["Campo","Notas"],
  ["supplier_type","GOODS = vende productos. SERVICES = servicios (no afectan inventario). BOTH = ambos."],
  ["locality","LOCAL o FOREIGN. Afecta fletes, retenciones."],
  ["is_occasional","TRUE = compra única. Ficha mínima, no se mantiene supplier_products. FALSE = recurrente."],
  ["payment_terms_days","Días de crédito que el PROVEEDOR te da."],
  ["avg_payment_time_days","TPP — días reales en que TÚ le pagas (KPI propio)."]
], [2400, 6960]));

ch.push(h3("Proveedor ocasional (is_occasional = TRUE)"));
ch.push(p("Casos: compra única para una emergencia, prestador de servicio que no se repite. Ventajas:"));
ch.push(bullet("Captura mínima — no se exige supplier_products ni datos completos."));
ch.push(bullet("Aparece marcado en reportes para identificarlos fácilmente."));
ch.push(bullet("El sistema no sugiere usarlos en futuras solicitudes de material."));

ch.push(h2("3.2 supplier_tax_data, supplier_addresses, supplier_contacts"));
ch.push(p("Estructura idéntica a las de cliente. Diferencias:"));
ch.push(bullet("supplier_tax_data NO tiene cfdi_use_id (eso solo aplica al receptor del CFDI; cuando recibes factura del proveedor, él decide su uso)."));
ch.push(bullet("supplier_addresses tiene tipo PICKUP en lugar de DELIVERY (donde se recoge la mercancía si tú vas por ella)."));

ch.push(h2("3.3 supplier_products — el catálogo del proveedor con histórico"));
ch.push(pBold("Aquí está la información: qué SKUs vende cada proveedor, a qué precio, con qué condiciones."));
ch.push(code(
`CREATE TABLE supplier_products (
    supplier_product_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_id     BIGINT NOT NULL REFERENCES suppliers(supplier_id),
    product_id      BIGINT NOT NULL REFERENCES products(product_id),
    supplier_sku    TEXT,
    unit_cost       NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
    currency        CHAR(3) NOT NULL DEFAULT 'MXN',
    lead_time_days  SMALLINT,
    moq             NUMERIC(14,4),
    is_available    BOOLEAN NOT NULL DEFAULT TRUE,
    is_preferred    BOOLEAN NOT NULL DEFAULT FALSE,
    valid_from      DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to        DATE,
    is_current      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);`));
ch.push(makeTable([
  ["Campo","Para qué"],
  ["supplier_sku","SKU del proveedor (Festo lo llama 'DSBC-50-100', tú 'CIL-FE-50'). Mapea ambos."],
  ["unit_cost","Precio del proveedor para ese SKU."],
  ["lead_time_days","Días típicos de entrega. Para planeación."],
  ["moq","Cantidad mínima de orden. Si pides menos, no procede."],
  ["is_preferred","Marcar al proveedor preferido para sugerirlo primero al crear OC."],
  ["valid_from / valid_to / is_current","Histórico de precios. NO se sobrescribe al cambiar precio."]
], [2400, 6960]));

ch.push(h3("Cómo cambiar precio de un proveedor (preserva histórico)"));
ch.push(code(
`BEGIN;
-- 1. Cerrar el precio vigente
UPDATE supplier_products
   SET valid_to = CURRENT_DATE - 1, is_current = FALSE
 WHERE supplier_id = 5 AND product_id = 100 AND is_current = TRUE;

-- 2. Insertar el nuevo precio
INSERT INTO supplier_products (supplier_id, product_id, supplier_sku, unit_cost, lead_time_days, moq, is_preferred)
VALUES (5, 100, 'DSBC-50-100-PPVA-N3', 2100, 14, 1, TRUE);
COMMIT;`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 4. RELACIONES CON OTROS MÓDULOS
ch.push(h1("4. Relación con otros módulos"));

ch.push(h2("4.1 Con Seguridad y Auditoría"));
ch.push(makeTable([
  ["Permiso","Roles que lo tienen"],
  ["customer.view","ADMIN, SALES, ACCOUNTING"],
  ["customer.manage","ADMIN, SALES"],
  ["supplier.view","ADMIN, PURCHASING, WAREHOUSE, ACCOUNTING"],
  ["supplier.manage","ADMIN, PURCHASING"]
], [3500, 5860]));
ch.push(p("Auditoría activa en customers, suppliers, customer_tax_data, supplier_tax_data, supplier_products. Cualquier cambio en RFC, límite de crédito, condiciones de pago, precios de proveedor queda en audit_log."));

ch.push(h2("4.2 Con Pricing"));
ch.push(p("customer_contract_prices (Ariba) es N:N entre customers y products. Vive en pricing pero conceptualmente es info del cliente — al ver la ficha de un cliente debe listar sus convenios activos."));
ch.push(p("supplier_products se conecta con el costo: cuando llega goods_receipt, el unit_cost típicamente coincide con supplier_products.unit_cost vigente. Si no coincide, hay que decidir si actualizar el catálogo o tratarlo como compra puntual."));

ch.push(h2("4.3 Con CFDI"));
ch.push(p("Al emitir un CFDI a un cliente, se hace SNAPSHOT de los datos fiscales:"));
ch.push(code(
`cfdi.receiver_rfc            ← customer_tax_data.rfc
cfdi.receiver_legal_name     ← customer_tax_data.legal_name
cfdi.receiver_tax_regime_id  ← customer_tax_data.tax_regime_id
cfdi.receiver_zip_code       ← customer_tax_data.zip_code
cfdi.cfdi_use_id             ← customer_tax_data.cfdi_use_id (default)`));
ch.push(p("Si el cliente cambia su régimen mañana, los CFDI emitidos no se modifican: son fotografías del momento."));

ch.push(h2("4.4 Con Compras y Cotizaciones"));
ch.push(bullet("quotes.customer_id, quotes.customer_address_id (DELIVERY) referencian al cliente."));
ch.push(bullet("orders.shipping_address_id apunta a customer_addresses tipo DELIVERY."));
ch.push(bullet("purchase_orders.supplier_id, supplier_invoices.supplier_id, goods_receipts.supplier_id referencian al proveedor."));
ch.push(bullet("quote_items.cost_source_supplier_id apunta al proveedor que justifica un override de costo puntual."));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 5. MIGRACIÓN
ch.push(h1("5. Migración desde Notion"));
ch.push(p("Pasos para migrar desde Directorio de Ubicaciones de Notion:"));
ch.push(numList("Filtrar las filas por property_tipo: Cliente vs Proveedor."));
ch.push(numList("Para clientes: INSERT en customers (code, business_name, locality según campo categoria)."));
ch.push(numList("Para cada cliente: INSERT en customer_tax_data con RFC y legal_name. CORREGIR el bug de raz_n_social: el slug está mapeado mal a 'Dirección', pero el valor real corresponde a la razón social fiscal."));
ch.push(numList("INSERT en customer_addresses como FISCAL (ligada a tax_data_id) si tienes el dato. Si no, capturar manualmente con operaciones."));
ch.push(numList("INSERT en customer_contacts con contacto_principal (is_primary=TRUE), email, teléfono."));
ch.push(numList("Para proveedores: análogo en suppliers, supplier_tax_data, supplier_addresses, supplier_contacts."));
ch.push(numList("Marcar suppliers.is_occasional según conozcan los recurrentes vs los ocasionales (decisión del equipo)."));
ch.push(numList("supplier_products: migrar desde 'Proveedores y Productos' del Notion viejo. Por cada (proveedor, producto): INSERT con valid_from = fecha de migración, is_current=TRUE."));

ch.push(h2("5.1 Mapeo de campos"));
ch.push(makeTable([
  ["Notion (raw)","PostgreSQL"],
  ["property_siglas_id","customers.code o suppliers.code"],
  ["property_nombre_del_cliente","business_name"],
  ["property_rfc","customer_tax_data.rfc o supplier_tax_data.rfc"],
  ["property_raz_n_social ⚠","legal_name (¡aquí se corrige el bug!)"],
  ["property_categoria","customers.locality (LOCAL/FOREIGN)"],
  ["property_estatus","is_active = (estatus = 'Activo')"],
  ["property_contacto_principal","customer_contacts.full_name con is_primary=TRUE"],
  ["property_email","customer_contacts.email"],
  ["property_tel_fono","customer_contacts.phone"],
  ["property_tpp","suppliers.avg_payment_time_days"],
  ["property_compra_anual_f","NO migrar (es derivado, lo recalcula la vista)"],
  ["property_precio_mxn (P&P)","supplier_products.unit_cost"],
  ["property_disponibilidad","supplier_products.is_available"]
], [3500, 5860]));

ch.push(h2("5.2 Validaciones post-migración"));
ch.push(code(
`-- Clientes sin datos fiscales
SELECT c.code, c.business_name FROM customers c
LEFT JOIN customer_tax_data ctd ON ctd.customer_id = c.customer_id
WHERE ctd.tax_data_id IS NULL AND c.is_active;

-- Direcciones FISCAL sin tax_data_id (rompe el CHECK)
SELECT * FROM customer_addresses
WHERE address_type = 'FISCAL' AND tax_data_id IS NULL;

-- Proveedores sin productos asociados (puede ser legítimo si is_occasional)
SELECT s.code, s.business_name, s.is_occasional
FROM suppliers s
LEFT JOIN supplier_products sp ON sp.supplier_id = s.supplier_id
WHERE sp.supplier_product_id IS NULL AND s.is_active;

-- RFCs duplicados entre clientes (sospechoso)
SELECT rfc, COUNT(*) FROM customer_tax_data GROUP BY rfc HAVING COUNT(*) > 1;`));

const doc = new Document({
  creator: "Sistema RTB",
  title: "Módulo de Clientes y Proveedores",
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
      children: [new TextRun({ text: "RTB · Clientes y Proveedores", font: ARIAL, size: 18, color: GRAY })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Página ", font: ARIAL, size: 18, color: GRAY }),
                 new TextRun({ children: [PageNumber.CURRENT], font: ARIAL, size: 18, color: GRAY })] })] }) },
    children: ch
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/sessions/bold-dazzling-brahmagupta/mnt/outputs/rtb/10_modulo_clientes_proveedores.docx", buf);
  console.log("DOCX listo:", buf.length, "bytes");
});

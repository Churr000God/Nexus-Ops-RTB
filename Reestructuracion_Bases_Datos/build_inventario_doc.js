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
  children: [new TextRun({ text: "Inventario · No Conformes", font: ARIAL, size: 48, bold: true })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
  children: [new TextRun({ text: "y Gestión de Equipos", font: ARIAL, size: 48, bold: true })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360, after: 120 },
  children: [new TextRun({ text: "Sistema RTB · PostgreSQL", font: ARIAL, size: 28, color: GRAY })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "Stock · KPIs · Snapshots · Inventario interno · Assets · Componentes intercambiables", font: ARIAL, size: 18, color: GRAY })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 },
  children: [new TextRun({ text: "Documento de diseño y operación · v1.0", font: ARIAL, size: 22, color: GRAY })] }));
ch.push(new Paragraph({ children: [new PageBreak()] }));

// 1. INTRO
ch.push(h1("1. Introducción"));
ch.push(p("Este documento describe el módulo de inventario completo: stock por SKU (vendible e interno), KPIs derivados, no conformes, y la novedad: gestión de equipos con piezas intercambiables (assets)."));

ch.push(h2("1.1 Tres niveles de control"));
ch.push(makeTable([
  ["Nivel","Tablas","Concepto"],
  ["Stock por SKU","inventory_movements + vistas","Bitácora de entradas y salidas; stock por SKU se calcula"],
  ["Inventario interno","products.is_saleable + v_internal_inventory","Productos NO vendibles que sí necesitan stock (tóner, papel)"],
  ["Equipos físicos","assets + asset_components + asset_component_history","PCs, máquinas con identidad propia; cambian componentes con el tiempo"]
], [2200, 3500, 3660]));

ch.push(h2("1.2 Tablas que componen el módulo"));
ch.push(makeTable([
  ["Tabla","Propósito"],
  ["inventory_movements","Bitácora unificada — única fuente de verdad del stock"],
  ["non_conformities","Defectos y ajustes (con nc_source para distinguir origen)"],
  ["inventory_snapshots","Cierres mensuales inmutables"],
  ["assets","Equipos físicos individuales (PCs, máquinas, vehículos)"],
  ["asset_components","Partes actualmente instaladas en cada equipo"],
  ["asset_component_history","Historial inmutable de instalaciones y removidos"],
  ["v_inventory_current","Stock actual (cantidad, costo promedio, estado)"],
  ["v_inventory_kpis","KPIs (ABC, días sin movimiento, semáforo)"],
  ["v_internal_inventory","Stock SOLO de productos no vendibles"],
  ["v_saleable_inventory","Stock SOLO de productos vendibles (catálogo de venta)"],
  ["v_asset_current_components","Componentes vigentes por equipo"],
  ["v_asset_repair_history","Historial de mantenimiento de cada equipo"]
], [3000, 6360]));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 2. STOCK Y KPIs
ch.push(h1("2. Stock y KPIs"));
ch.push(p("El sistema usa el principio de \"una sola fuente de verdad\": inventory_movements registra cada entrada/salida; todo lo demás es vista derivada."));

ch.push(h2("2.1 inventory_movements (recap)"));
ch.push(code(
`movement_type:    RECEIPT, ISSUE, ADJUSTMENT_IN, ADJUSTMENT_OUT,
                  RETURN_IN, RETURN_OUT, TRANSFER_IN, TRANSFER_OUT,
                  OPENING_BALANCE
source_type:      GOODS_RECEIPT, ORDER_ITEM, NON_CONFORMITY,
                  MANUAL_ADJUSTMENT, OPENING, RETURN,
                  ASSET_INSTALL, ASSET_REMOVE     ← NUEVOS para equipos`));

ch.push(h2("2.2 Vistas derivadas"));
ch.push(makeTable([
  ["Vista","Contenido"],
  ["v_inventory_current","quantity_on_hand, avg_unit_cost, stock_status (OK/BELOW_MIN/OUT)"],
  ["v_inventory_kpis","Demanda 90/180 días, ABC, semáforo, acción sugerida"],
  ["v_saleable_inventory","Solo productos is_saleable=TRUE"],
  ["v_internal_inventory","Solo productos is_saleable=FALSE"]
], [2500, 6860]));

ch.push(h2("2.3 inventory_snapshots (cierres mensuales)"));
ch.push(p("Al final de cada mes, un job inserta una fila por SKU con cantidad, costo promedio, valor total. Es inmutable. Sirve para reportes históricos y comparativos anuales sin recalcular millones de movements."));
ch.push(code(
`SELECT product_id, snapshot_date, quantity_on_hand, avg_unit_cost, total_value
FROM inventory_snapshots
WHERE snapshot_date = '2026-03-31'
ORDER BY total_value DESC;`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 3. INVENTARIO INTERNO
ch.push(h1("3. Inventario interno (productos no vendibles)"));

ch.push(h2("3.1 Concepto"));
ch.push(p("Hay materiales que tu empresa consume internamente (tóner para impresoras, papel, gasolina, herramientas, refacciones de oficina) que NO se venden, pero SÍ necesitas trackear su stock para:"));
ch.push(bullet("Saber cuándo reordenar"));
ch.push(bullet("Distribuir costo a centros de gestión"));
ch.push(bullet("Auditoría y control de existencias"));
ch.push(bullet("Históricos de consumo"));

ch.push(h2("3.2 Solución: products.is_saleable"));
ch.push(code(
`ALTER TABLE products ADD COLUMN is_saleable BOOLEAN NOT NULL DEFAULT TRUE;

-- TRUE  = aparece en cotizaciones, ventas, catálogo público
-- FALSE = solo uso interno; aparece en stock pero NO en pantallas de venta`));

ch.push(p("Toda la lógica de inventario funciona igual: triggers de costo promedio, KPIs, snapshots. La diferencia es que los products is_saleable=FALSE se filtran en queries de venta."));

ch.push(h2("3.3 Cómo se separan en pantallas"));
ch.push(makeTable([
  ["Pantalla","Filtra por"],
  ["Catálogo de ventas / cotización","is_saleable = TRUE AND is_active = TRUE"],
  ["Inventario completo (almacén)","is_active = TRUE (incluye ambos)"],
  ["Inventario interno (admin)","is_saleable = FALSE"],
  ["Compras (purchase_request)","is_active = TRUE (puede comprar ambos)"]
], [3500, 5860]));

ch.push(h2("3.4 Conexión con compras"));
ch.push(p("Lo que ya quedó modelado en el bloque de compras:"));
ch.push(bullet("purchase_request_items.item_type = 'GOODS_RESALE' → para vender (is_saleable=TRUE)"));
ch.push(bullet("purchase_request_items.item_type = 'GOODS_INTERNAL' → para uso interno (is_saleable=FALSE)"));
ch.push(p("Convenio: cuando capturas un nuevo SKU para uso interno, lo creas con is_saleable=FALSE; cuando es para venta, con TRUE."));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 4. ASSETS
ch.push(h1("4. Equipos con piezas intercambiables (assets)"));

ch.push(h2("4.1 Concepto: una PC no es un \"producto en stock\""));
ch.push(p("Hay objetos que NO se manejan como inventario regular porque cada uno es ÚNICO y CAMBIA con el tiempo:"));
ch.push(bullet("Una PC de oficina: hoy tiene 16GB RAM, mañana le pones 32GB. La PC sigue siendo \"PC-001\", pero su contenido cambió."));
ch.push(bullet("Una máquina de producción: a la que se le cambian rodamientos, motores, sensores."));
ch.push(bullet("Un vehículo de la flota: con sus refacciones."));
ch.push(p("Para esto hay tres tablas:"));

ch.push(h2("4.2 assets"));
ch.push(code(
`CREATE TABLE assets (
    asset_id          BIGINT PK,
    asset_code        TEXT UNIQUE,            -- 'PC-001', 'IMP-005', 'MAQ-PR-002'
    asset_type        TEXT (COMPUTER, LAPTOP, PRINTER, MACHINE, VEHICLE, TOOL, OTHER),
    name              TEXT,                   -- "PC ventas — Diego"
    base_product_id   BIGINT FK products,     -- modelo del catálogo (opcional)
    serial_number     TEXT,
    manufacturer, model,
    location          TEXT,                   -- 'Oficina', 'Planta'
    assigned_user_id  BIGINT FK users,
    status            TEXT (ACTIVE, IN_REPAIR, IDLE, RETIRED, DISMANTLED),
    purchase_date, purchase_cost, warranty_until,
    notes
);`));

ch.push(h2("4.3 asset_components (estado actual)"));
ch.push(p("Las partes que tiene cada equipo AHORA. Cambia con el tiempo."));
ch.push(code(
`CREATE TABLE asset_components (
    asset_component_id BIGINT PK,
    asset_id           BIGINT FK assets,
    product_id         BIGINT FK products,    -- la pieza (RAM, disco)
    quantity           NUMERIC DEFAULT 1,
    serial_number      TEXT,                  -- si la pieza tiene serial propio
    installed_at       TIMESTAMPTZ,
    installed_by       BIGINT FK users,
    notes              TEXT
);`));

ch.push(h2("4.4 asset_component_history (log inmutable)"));
ch.push(code(
`CREATE TABLE asset_component_history (
    history_id           BIGINT PK,
    asset_id, product_id BIGINT FK,
    operation            TEXT (INSTALL, REMOVE, REPLACE),
    quantity             NUMERIC,
    serial_number        TEXT,
    occurred_at          TIMESTAMPTZ,
    user_id              BIGINT FK,
    inventory_movement_id BIGINT FK,           -- el movimiento de stock vinculado
    nc_id                BIGINT FK,            -- si la pieza salió defectuosa
    reason, notes
);`));
ch.push(p("Cada cambio de pieza queda en este log. Permite responder: \"¿qué piezas se le han cambiado a esta PC en el último año?\""));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 5. FLUJO DE INSTALACIÓN
ch.push(h1("5. Flujo de instalación de pieza"));
ch.push(p("Cuando el técnico instala una RAM nueva en PC-001:"));

ch.push(h2("5.1 Operación"));
ch.push(code(
`INSERT INTO asset_components (
    asset_id, product_id, quantity, serial_number, installed_by, notes
) VALUES (
    (SELECT asset_id FROM assets WHERE asset_code = 'PC-001'),
    (SELECT product_id FROM products WHERE sku = 'RAM-DDR4-32GB'),
    1, 'CRC-12345-A', user_id, 'Upgrade de 16GB a 32GB'
);`));

ch.push(h2("5.2 Lo que pasa automáticamente vía trigger"));
ch.push(numList("fn_on_component_install dispara INSERT en inventory_movements:"));
ch.push(code(
`-- Se crea un movement ISSUE
INSERT INTO inventory_movements (
    product_id, movement_type, source_type, source_id, quantity_out, ...
) VALUES (
    ram_id, 'ISSUE', 'ASSET_INSTALL', asset_component_id, 1, ...
);`));
ch.push(numList("Se inserta fila en asset_component_history:"));
ch.push(code(
`INSERT INTO asset_component_history (
    asset_id, product_id, operation, quantity, ..., inventory_movement_id
) VALUES (
    pc001_id, ram_id, 'INSTALL', 1, ..., movement_id
);`));
ch.push(numList("v_inventory_current: el stock de RAM disminuye en 1"));
ch.push(numList("v_asset_current_components: PC-001 ahora tiene la nueva RAM listada"));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 6. FLUJO DE REMOCIÓN
ch.push(h1("6. Flujo de removida de pieza"));
ch.push(p("Cuando el técnico saca un disco descompuesto, hay dos casos."));

ch.push(h2("6.1 Caso A: pieza reutilizable (vuelve a stock)"));
ch.push(code(
`SELECT fn_remove_asset_component(
    p_asset_component_id := 123,
    p_is_reusable        := TRUE,        -- pieza buena
    p_user_id            := user_id,
    p_reason             := 'Upgrade — disco reasignado a otro equipo',
    p_notes              := NULL
);`));
ch.push(p("Lo que hace la función:"));
ch.push(bullet("Crea inventory_movement tipo RETURN_IN (la pieza vuelve al stock)"));
ch.push(bullet("Inserta asset_component_history con operation='REMOVE'"));
ch.push(bullet("Borra la fila de asset_components (ya no está en el equipo)"));

ch.push(h2("6.2 Caso B: pieza defectuosa (no conforme)"));
ch.push(code(
`SELECT fn_remove_asset_component(
    p_asset_component_id := 124,
    p_is_reusable        := FALSE,       -- pieza dañada
    p_user_id            := user_id,
    p_reason             := 'Disco con sectores dañados',
    p_notes              := 'No reparable — para baja'
);`));
ch.push(p("Lo que hace la función:"));
ch.push(bullet("Crea non_conformity con nc_source='ASSET_REMOVAL', adjustment_type='OUT'"));
ch.push(bullet("El trigger fn_create_inv_movement_from_nc genera el inventory_movement ADJUSTMENT_OUT"));
ch.push(bullet("Inserta asset_component_history con operation='REMOVE' y nc_id apuntando al NC"));
ch.push(bullet("Borra la fila de asset_components"));

ch.push(h2("6.3 Trazabilidad completa"));
ch.push(code(
`SELECT * FROM v_asset_repair_history WHERE asset_code = 'PC-001';

-- Devuelve cronológicamente:
-- 2025-01-15  INSTALL   RAM 16GB    qty 2  por María   (movement_id: 100)
-- 2026-04-20  REMOVE    RAM 16GB    qty 2  por Carlos  reason: 'Upgrade'
-- 2026-04-20  INSTALL   RAM 32GB    qty 2  por Carlos  (movement_id: 250)
-- 2026-08-10  REMOVE    Disco 1TB   qty 1  por Carlos  reason: 'Sectores dañados' (nc_id: 45)
-- 2026-08-10  INSTALL   Disco 2TB   qty 1  por Carlos  (movement_id: 380)`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 7. NO CONFORMES EXTENDIDOS
ch.push(h1("7. No conformes (non_conformities) extendidos"));

ch.push(h2("7.1 Nueva columna nc_source"));
ch.push(makeTable([
  ["nc_source","Cuándo aplica"],
  ["SUPPLIER","Material recibido defectuoso del proveedor (caso original)"],
  ["CUSTOMER_RETURN","Cliente devolvió material defectuoso"],
  ["ASSET_REMOVAL","Pieza retirada de equipo por mal funcionamiento"],
  ["PHYSICAL_COUNT","Diferencia detectada en conteo físico"],
  ["OTHER","Otros motivos"]
], [2200, 7160]));

ch.push(h2("7.2 Vínculo opcional con asset"));
ch.push(p("Cuando nc_source = 'ASSET_REMOVAL', la columna asset_id apunta al equipo origen. Esto permite reportes como: \"piezas defectuosas por equipo\"."));
ch.push(code(
`-- Equipos con más fallas en el año
SELECT a.asset_code, a.name, COUNT(nc.nc_id) AS fallas
FROM assets a
JOIN non_conformities nc ON nc.asset_id = a.asset_id
WHERE nc.nc_date >= now() - INTERVAL '1 year'
GROUP BY a.asset_code, a.name
ORDER BY fallas DESC;`));

ch.push(h2("7.3 Flujo automático del trigger"));
ch.push(p("Sigue funcionando igual: cualquier non_conformity (sin importar nc_source) dispara fn_create_inv_movement_from_nc que ajusta inventario."));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 8. CONSULTAS COMUNES
ch.push(h1("8. Consultas comunes"));

ch.push(h2("8.1 Stock vendible vs interno separado"));
ch.push(code(
`-- Inventario para venta
SELECT * FROM v_saleable_inventory WHERE quantity_on_hand > 0;

-- Inventario interno
SELECT * FROM v_internal_inventory WHERE quantity_on_hand > 0;`));

ch.push(h2("8.2 Componentes actuales de un equipo"));
ch.push(code(
`SELECT component_sku, component_name, quantity, serial_number, installed_at
FROM v_asset_current_components
WHERE asset_code = 'PC-001';`));

ch.push(h2("8.3 ¿Qué piezas se han cambiado a una máquina?"));
ch.push(code(
`SELECT occurred_at, operation, component_sku, quantity, performed_by, reason
FROM v_asset_repair_history
WHERE asset_code = 'MAQ-PR-002'
ORDER BY occurred_at DESC;`));

ch.push(h2("8.4 ¿Qué tan reutilizadas son las piezas (vienen de assets)?"));
ch.push(code(
`SELECT product_id, COUNT(*) AS veces_devuelto_a_stock
FROM inventory_movements
WHERE source_type = 'ASSET_REMOVE'
GROUP BY product_id
ORDER BY veces_devuelto_a_stock DESC;`));

ch.push(h2("8.5 Equipos por estatus"));
ch.push(code(
`SELECT status, COUNT(*) FROM assets GROUP BY status ORDER BY status;`));

const doc = new Document({
  creator: "Sistema RTB", title: "Inventario, No Conformes y Assets",
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
      children: [new TextRun({ text: "RTB · Inventario y Assets", font: ARIAL, size: 18, color: GRAY })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Página ", font: ARIAL, size: 18, color: GRAY }),
                 new TextRun({ children: [PageNumber.CURRENT], font: ARIAL, size: 18, color: GRAY })] })] }) },
    children: ch
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/sessions/bold-dazzling-brahmagupta/mnt/outputs/rtb/13_modulo_inventario_assets.docx", buf);
  console.log("DOCX listo:", buf.length, "bytes");
});

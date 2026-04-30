// Genera 09_modulo_productos_pricing.docx
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, Header, Footer, PageBreak
} = require('docx');

const ARIAL = "Arial";
const COLOR_DARK = "1F2937";
const COLOR_GRAY = "6B7280";
const COLOR_BLUE = "2563EB";
const COLOR_HEADER = "1F2937";
const COLOR_CODE_BG = "F3F4F6";

const heading = (text, level) => new Paragraph({
  heading: level,
  children: [new TextRun({ text, font: ARIAL })]
});
const h1 = (t) => heading(t, HeadingLevel.HEADING_1);
const h2 = (t) => heading(t, HeadingLevel.HEADING_2);
const h3 = (t) => heading(t, HeadingLevel.HEADING_3);
const p = (t, opts={}) => new Paragraph({
  children: [new TextRun({ text: t, font: ARIAL, ...opts })],
  spacing: { after: 120 }
});
const pBold = (t) => p(t, { bold: true });
const pItalic = (t) => p(t, { italics: true });

const code = (text) => {
  const lines = text.split('\n');
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: COLOR_CODE_BG },
    spacing: { before: 120, after: 120 },
    children: lines.flatMap((line, i) => {
      const runs = [new TextRun({ text: line || ' ', font: "Courier New", size: 18 })];
      if (i < lines.length - 1) runs.push(new TextRun({ break: 1 }));
      return runs;
    })
  });
};

const bullet = (t) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  children: [new TextRun({ text: t, font: ARIAL })]
});
const numList = (t) => new Paragraph({
  numbering: { reference: "numbers", level: 0 },
  children: [new TextRun({ text: t, font: ARIAL })]
});

const border = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

function makeTable(rows, columnWidths) {
  const totalWidth = columnWidths.reduce((a,b)=>a+b,0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths,
    rows: rows.map((row, idx) => new TableRow({
      tableHeader: idx === 0,
      children: row.map((cell, cIdx) => {
        const cellObj = typeof cell === 'string' ? { text: cell } : cell;
        return new TableCell({
          borders,
          width: { size: columnWidths[cIdx], type: WidthType.DXA },
          shading: idx === 0 ? { fill: COLOR_HEADER, type: ShadingType.CLEAR } : undefined,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            children: [new TextRun({
              text: cellObj.text,
              font: cellObj.mono ? "Courier New" : ARIAL,
              size: cellObj.mono ? 18 : 20,
              bold: idx === 0 || cellObj.bold,
              color: idx === 0 ? "FFFFFF" : COLOR_DARK
            })]
          })]
        });
      })
    }))
  });
}

const children = [];

// PORTADA
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 2400, after: 240 },
  children: [new TextRun({ text: "Módulo de Productos", font: ARIAL, size: 56, bold: true })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 240 },
  children: [new TextRun({ text: "y Pricing", font: ARIAL, size: 56, bold: true })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 360, after: 120 },
  children: [new TextRun({ text: "Sistema RTB · PostgreSQL", font: ARIAL, size: 28, color: COLOR_GRAY })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "Catálogos · Productos configurables · BOM · Estrategias de pricing · Convenios Ariba", font: ARIAL, size: 20, color: COLOR_BLUE })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 1200 },
  children: [new TextRun({ text: "Documento de diseño y operación · v1.0", font: ARIAL, size: 22, color: COLOR_GRAY })]
}));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 1. INTRODUCCIÓN
children.push(h1("1. Introducción"));
children.push(p("Este documento describe el módulo de Productos y Pricing del sistema RTB. Cubre el catálogo (productos, marcas, categorías), la configurabilidad de maquinaria industrial (atributos, configuraciones, BOM), la lógica de cálculo de precios de venta basada en costo promedio móvil con margen por categoría, los convenios de precios fijos (Ariba) y los overrides puntuales en cotizaciones."));

children.push(h2("1.1 Reglas de negocio que rigen este módulo"));
children.push(makeTable([
  ["Regla", "Definición"],
  ["Margen", "El % de utilidad vive solo en la categoría. No hay overrides por producto."],
  ["Cálculo", "Markup sobre costo: precio_venta = costo × (1 + margen/100)."],
  ["Costo", "Promedio ponderado de las recepciones de los últimos 6 meses (configurable por producto)."],
  ["Recepción nueva", "Recalcula el promedio del producto y su precio se mueve solo."],
  ["Convenio Ariba", "Precio fijo acordado por cliente+producto. No se calcula. Solo cambia con notificación formal del cliente."],
  ["Refacciones especiales (PASSTHROUGH)", "Se venden al costo de compra, sin margen aplicado."],
  ["Promociones", "No son tabla. Se aplican como descuento en quote_items.discount_pct."],
  ["Override puntual", "El vendedor puede capturar costo manual con justificación obligatoria si la situación lo amerita (proveedor nuevo, precio fuera de rango)."],
  ["Cotización aprobada", "Precio congelado. Cambios futuros de costo NO afectan cotizaciones ya enviadas."]
], [3500, 5860]));

children.push(h2("1.2 Tablas que componen el módulo"));
children.push(makeTable([
  ["Tabla", "Tipo", "Propósito breve"],
  ["brands", "Catálogo", "Marcas de los productos (Siemens, ABB, Festo, etc.)."],
  ["categories", "Catálogo (jerárquico)", "Clasificación de productos. Lleva el % de margen aplicable."],
  ["products", "Maestra", "Catálogo principal de productos. Define estrategia de pricing."],
  ["product_attributes", "Detalle", "Atributos configurables de cada producto (voltaje, color, etc.)."],
  ["product_attribute_options", "Detalle", "Valores predefinidos para atributos tipo OPTION."],
  ["product_configurations", "Detalle", "Instancia de un producto configurable con valores concretos."],
  ["bom · bom_items", "Estructura", "Lista de materiales para productos ensamblados."],
  ["customer_contract_prices", "Pricing", "Convenios de precio fijo por cliente+producto (Ariba)."],
  ["product_cost_history", "Bitácora", "Histórico inmutable de cambios en current_avg_cost."]
], [2700, 1800, 4860]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// 2. RELACIONES
children.push(h1("2. Relaciones entre tablas"));
children.push(p("Las relaciones se centran en la tabla products, que es el eje. Recibe FK desde catálogos auxiliares (brand, category, claves SAT) y emite FK hacia attributes, configurations, bom y al pricing (current_avg_cost vive en products mismo, pero el histórico está en product_cost_history)."));

children.push(h2("2.1 Diagrama de FKs"));
children.push(code(
`  brands ────────────► products ────► product_attributes ────► product_attribute_options
                          │
  categories ────────────►│ (tiene profit_margin_pct)
  (jerárquica vía         │
   parent_id)             ├────► product_configurations (JSONB attributes)
                          │
  sat_product_keys ──────►│
  sat_unit_keys ─────────►│
                          ├────► bom ────► bom_items ────► (otro product, recursivo)
                          │
                          └────► product_cost_history (bitácora)

  customers ──┐
              ├──► customer_contract_prices ◄── products
  (vive aquí Ariba: precio fijo cliente × producto)

  products.current_avg_cost ◄── recalculado por trigger desde inventory_movements (RECEIPT)`));

children.push(h2("2.2 Cardinalidades"));
children.push(makeTable([
  ["Origen → destino", "Cardinalidad"],
  ["brands → products", "1 : N"],
  ["categories → products", "1 : N"],
  ["categories → categories (parent_id)", "1 : N (jerárquica)"],
  ["products → product_attributes", "1 : N"],
  ["product_attributes → product_attribute_options", "1 : N"],
  ["products → product_configurations", "1 : N"],
  ["products → bom", "1 : N (versiones)"],
  ["bom → bom_items", "1 : N"],
  ["bom_items → products (component)", "N : 1 (recursivo: BOM dentro de BOM)"],
  ["customers ↔ products (vía customer_contract_prices)", "N : N"],
  ["products → product_cost_history", "1 : N"]
], [5500, 3860]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// 3. CATÁLOGOS
children.push(h1("3. Catálogos auxiliares"));

children.push(h2("3.1 brands"));
children.push(pBold("Propósito: marcas que fabrican los productos."));
children.push(code(
`CREATE TABLE brands (
    brand_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);`));
children.push(makeTable([
  ["Campo","Tipo","Notas"],
  ["brand_id","BIGINT","PK auto."],
  ["name","TEXT UNIQUE","'Siemens', 'ABB', 'Festo'."],
  ["is_active","BOOLEAN","Para descontinuar marca sin borrar histórico."]
], [1800, 2400, 5160]));
children.push(p("Se llena al migrar desde Notion (property_marca[0]) y se mantiene desde la pantalla de catálogo (permiso product.manage)."));

children.push(h2("3.2 categories"));
children.push(pBold("Propósito: clasificación jerárquica de productos. Aquí vive el margen aplicable."));
children.push(code(
`CREATE TABLE categories (
    category_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parent_id          BIGINT REFERENCES categories(category_id),
    name               TEXT NOT NULL,
    slug               TEXT NOT NULL UNIQUE,
    profit_margin_pct  NUMERIC(5,2) NOT NULL DEFAULT 35
        CHECK (profit_margin_pct >= 0 AND profit_margin_pct <= 1000),
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (parent_id, name)
);`));
children.push(makeTable([
  ["Campo","Tipo","Notas"],
  ["category_id","BIGINT","PK auto."],
  ["parent_id","BIGINT FK self","NULL = categoría raíz; FK a otra categoría = subcategoría."],
  ["name","TEXT","Nombre humano. UNIQUE bajo el mismo parent_id."],
  ["slug","TEXT UNIQUE","Identificador URL/ruta-amigable: 'neumatica-cilindros'."],
  ["profit_margin_pct","NUMERIC(5,2)","Markup. precio = costo × (1 + profit_margin_pct/100)."],
  ["is_active","BOOLEAN","Para descontinuar categoría."]
], [2200, 2200, 4960]));
children.push(p("La hijos heredan implícitamente el margen del padre solo si tu app lo decide. En la base de datos cada categoría tiene su propio profit_margin_pct (no hay herencia automática). Esta es una decisión deliberada para flexibilidad."));

children.push(h2("3.3 Ejemplo de categorías con margen"));
children.push(makeTable([
  ["category_id","parent_id","name","profit_margin_pct"],
  ["1","NULL","Neumática","35.00"],
  ["2","1","Cilindros","35.00"],
  ["3","1","Válvulas","35.00"],
  ["4","NULL","Eléctrica","28.00"],
  ["5","4","Variadores","28.00"],
  ["6","NULL","Hidráulica","40.00"],
  ["7","NULL","Refacciones genéricas","22.00"]
], [1500, 1500, 3000, 3360]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// 4. PRODUCTS
children.push(h1("4. Tabla products"));
children.push(pBold("Propósito: catálogo maestro. Cada SKU base tiene una fila aquí."));

children.push(h2("4.1 Definición"));
children.push(code(
`CREATE TABLE products (
    product_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku                 TEXT NOT NULL UNIQUE,
    internal_code       TEXT UNIQUE,
    name                TEXT NOT NULL,
    description         TEXT,
    brand_id            BIGINT REFERENCES brands(brand_id),
    category_id         BIGINT NOT NULL REFERENCES categories(category_id),
    sat_product_key_id  BIGINT REFERENCES sat_product_keys(key_id),
    sat_unit_id         BIGINT REFERENCES sat_unit_keys(unit_id),
    is_configurable     BOOLEAN NOT NULL DEFAULT FALSE,
    is_assembled        BOOLEAN NOT NULL DEFAULT FALSE,
    package_size        NUMERIC(12,4),
    min_stock           NUMERIC(14,4) NOT NULL DEFAULT 0,
    -- Pricing
    pricing_strategy    TEXT NOT NULL DEFAULT 'MOVING_AVG'
        CHECK (pricing_strategy IN ('MOVING_AVG','PASSTHROUGH')),
    moving_avg_months   SMALLINT NOT NULL DEFAULT 6
        CHECK (moving_avg_months BETWEEN 1 AND 60),
    current_avg_cost            NUMERIC(14,4),
    current_avg_cost_currency   CHAR(3) NOT NULL DEFAULT 'MXN',
    current_avg_cost_updated_at TIMESTAMPTZ,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);`));

children.push(h2("4.2 Campos clave de pricing"));
children.push(makeTable([
  ["Campo","Tipo","Significado"],
  ["pricing_strategy","TEXT","MOVING_AVG = costo×(1+margen). PASSTHROUGH = precio = costo (sin margen)."],
  ["moving_avg_months","SMALLINT","Ventana del promedio móvil. Default 6. Configurable por producto."],
  ["current_avg_cost","NUMERIC(14,4)","Caché del promedio ponderado actual. Recalculado por trigger en cada RECEIPT y por job nocturno."],
  ["current_avg_cost_currency","CHAR(3)","Moneda del costo (MXN por default)."],
  ["current_avg_cost_updated_at","TIMESTAMPTZ","Última vez que se recalculó."]
], [3000, 1800, 4560]));

children.push(h2("4.3 Las dos estrategias en una tabla"));
children.push(makeTable([
  ["Estrategia","Fórmula","Cuándo usarla"],
  ["MOVING_AVG (default)","precio = current_avg_cost × (1 + categoría.margen/100)","La gran mayoría: maquinaria, refacciones estándar, accesorios."],
  ["PASSTHROUGH","precio = current_avg_cost","Refacciones que se manejan al costo. Pedidos especiales que no cargan margen. Casos donde el cliente paga el costo de compra exacto."]
], [2400, 3500, 3460]));

children.push(h2("4.4 Cómo se llena al crear un producto"));
children.push(numList("La app pide los datos básicos: SKU, nombre, descripción, brand_id, category_id."));
children.push(numList("Asigna sat_product_key_id y sat_unit_id (matching contra los catálogos SAT)."));
children.push(numList("Define is_configurable e is_assembled según el tipo de producto."));
children.push(numList("Por default pricing_strategy = 'MOVING_AVG' y moving_avg_months = 6."));
children.push(numList("Si es una refacción especial, cambia pricing_strategy a 'PASSTHROUGH'."));
children.push(numList("current_avg_cost se queda NULL hasta que entre la primera recepción de mercancía."));

children.push(h2("4.5 Reglas operativas"));
children.push(bullet("NUNCA editar manualmente current_avg_cost. Es derivado, lo mantiene el trigger."));
children.push(bullet("Para descontinuar un producto: is_active = FALSE. Sigue apareciendo en histórico, deja de aparecer en cotizaciones nuevas."));
children.push(bullet("Cambiar de MOVING_AVG a PASSTHROUGH (o viceversa) afecta cotizaciones futuras, NO las pasadas."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// 5. CONFIGURABILIDAD
children.push(h1("5. Productos configurables"));
children.push(p("Los productos con is_configurable = TRUE soportan que el cliente elija opciones (voltaje, color, capacidad). Tres tablas trabajan en conjunto:"));

children.push(h2("5.1 product_attributes"));
children.push(p("Cada producto define sus atributos disponibles."));
children.push(code(
`CREATE TABLE product_attributes (
    attribute_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id    BIGINT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    data_type     TEXT NOT NULL CHECK (data_type IN ('TEXT','NUMBER','BOOLEAN','OPTION')),
    is_required   BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order    SMALLINT NOT NULL DEFAULT 0,
    UNIQUE (product_id, name)
);`));
children.push(makeTable([
  ["data_type","Significa"],
  ["TEXT","Texto libre (ej. grabado, número de placa)."],
  ["NUMBER","Número decimal (ej. capacidad en litros)."],
  ["BOOLEAN","Sí/no (ej. garantía extendida)."],
  ["OPTION","Lista predefinida en product_attribute_options."]
], [1500, 7860]));

children.push(h2("5.2 product_attribute_options"));
children.push(p("Valores válidos para atributos OPTION, con sobrecosto opcional por opción."));
children.push(code(
`CREATE TABLE product_attribute_options (
    option_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    attribute_id  BIGINT NOT NULL REFERENCES product_attributes(attribute_id) ON DELETE CASCADE,
    value         TEXT NOT NULL,
    extra_cost    NUMERIC(14,4) NOT NULL DEFAULT 0,
    UNIQUE (attribute_id, value)
);`));

children.push(h2("5.3 product_configurations"));
children.push(p("Una configuración concreta que un cliente cotizó: producto + valores específicos en JSONB."));
children.push(code(
`CREATE TABLE product_configurations (
    configuration_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id         BIGINT NOT NULL REFERENCES products(product_id),
    config_sku         TEXT UNIQUE,
    config_hash        TEXT NOT NULL,
    attributes         JSONB NOT NULL,
    additional_cost    NUMERIC(14,4) NOT NULL DEFAULT 0,
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, config_hash)
);`));
children.push(p("config_hash es SHA256 del JSONB normalizado: si dos cotizaciones piden la misma combinación, se reutiliza la misma configuration_id (deduplicación)."));

children.push(h2("5.4 Ejemplo: Compresor XS-200"));
children.push(p("Atributos definidos:"));
children.push(makeTable([
  ["attribute_id","name","data_type","is_required"],
  ["100","Voltaje","OPTION","true"],
  ["101","Color","OPTION","false"],
  ["102","Capacidad (L)","NUMBER","true"]
], [1500, 2500, 2500, 2860]));
children.push(p("Opciones del atributo Voltaje:"));
children.push(makeTable([
  ["option_id","value","extra_cost"],
  ["200","110V","0"],
  ["201","220V","1500"],
  ["202","440V","3000"]
], [1500, 4000, 3860]));
children.push(p("Cliente pide configuración:"));
children.push(code(
`INSERT INTO product_configurations (product_id, config_sku, config_hash, attributes, additional_cost)
VALUES (
    42,                                           -- XS-200
    'XS-200-220V-RED-100L',
    md5('{"Voltaje":"220V","Color":"Rojo","Capacidad":100}'),
    '{"Voltaje":"220V","Color":"Rojo","Capacidad":100}'::JSONB,
    1500                                          -- sobrecosto del 220V
);`));

children.push(h2("5.5 Cómo afecta al pricing"));
children.push(p("La configuración suma additional_cost al costo base. La cotización registra el SKU base + configuration_id + el costo y precio resultantes:"));
children.push(code(
`-- Costo base del producto: products.current_avg_cost = $40,000
-- Sobrecosto por 220V: $1,500
-- Costo total para esta configuración: $41,500
-- Margen Neumática: 35%
-- Precio de venta: $41,500 × 1.35 = $56,025`));

children.push(new Paragraph({ children: [new PageBreak()] }));

// 6. BOM
children.push(h1("6. BOM (Bill of Materials)"));
children.push(p("Para productos con is_assembled = TRUE, el BOM define qué partes los componen. Sirve para descontar inventario de los componentes cuando se vende un ensamblado, y para calcular costo de producción."));

children.push(h2("6.1 bom"));
children.push(code(
`CREATE TABLE bom (
    bom_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id  BIGINT NOT NULL REFERENCES products(product_id),
    version     SMALLINT NOT NULL DEFAULT 1,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, version)
);`));
children.push(p("Se versionan los BOM porque cambian: un proveedor descontinúa una parte, optimizas el diseño, etc. Conservas todas las versiones; solo una está activa por producto."));

children.push(h2("6.2 bom_items"));
children.push(code(
`CREATE TABLE bom_items (
    bom_item_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bom_id        BIGINT NOT NULL REFERENCES bom(bom_id) ON DELETE CASCADE,
    component_id  BIGINT NOT NULL REFERENCES products(product_id),
    quantity      NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
    notes         TEXT
);`));
children.push(p("component_id apunta a otro product_id. Esto permite BOM anidados: un motor 5HP puede tener su propio BOM dentro del BOM del compresor."));

children.push(h2("6.3 Ejemplo: BOM v1 del Compresor XS-200"));
children.push(makeTable([
  ["bom_item_id","component_id","SKU","quantity"],
  ["1","1500","MOTOR-5HP","1"],
  ["2","1501","TANK-100L","1"],
  ["3","1502","MANOMETRO","2"],
  ["4","1503","VALV-SEG","1"],
  ["5","1504","KIT-TORN","1"]
], [1700, 1800, 2700, 3160]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// 7. PRICING DETALLE
children.push(h1("7. Lógica de pricing detallada"));
children.push(p("El precio final que se cobra a un cliente se decide en cascada. La función fn_get_quote_pricing(product_id, customer_id, quantity) implementa esta lógica."));

children.push(h2("7.1 Diagrama de decisión"));
children.push(code(
`PARA UNA COMBINACIÓN cliente + producto:
                                 ┌──────────────────────────────┐
                                 │ ¿Hay convenio Ariba vigente? │
                                 └──────────┬───────────────────┘
                                            │
                          ┌─────────────────┴────────────────┐
                          │                                  │
                         SÍ                                 NO
                          │                                  │
                          ▼                                  ▼
                  ┌──────────────┐                ┌────────────────────┐
                  │ Precio fijo  │                │ pricing_strategy   │
                  │ del convenio │                └──────┬─────────────┘
                  └──────────────┘                       │
                                          ┌──────────────┴──────────────┐
                                          ▼                             ▼
                                   MOVING_AVG                    PASSTHROUGH
                                   precio = avg ×                precio = avg
                                   (1 + margen)                  (sin margen)


SOBRE ESE PRECIO, EL VENDEDOR PUEDE EN LA COTIZACIÓN:
  • Aplicar descuento (quote_items.discount_pct)        ← promociones
  • Capturar costo manual con justificación             ← compra puntual a proveedor nuevo`));

children.push(h2("7.2 Las cinco bases de costo (cost_basis en quote_items)"));
children.push(makeTable([
  ["cost_basis","Cuándo aparece","Costo usado","Justificación obligatoria"],
  ["MOVING_AVG","Default sin convenio","current_avg_cost","No"],
  ["PASSTHROUGH","Producto con strategy = PASSTHROUGH","current_avg_cost","No"],
  ["CONTRACT_FIXED","Cliente tiene convenio Ariba vigente","No aplica (precio fijo)","No"],
  ["SUPPLIER_SPECIFIC","Vendedor sustituye costo por uno específico de un proveedor","Costo capturado","Sí, mínimo 10 caracteres"],
  ["MANUAL_OVERRIDE","Vendedor captura costo arbitrario","Costo capturado","Sí, mínimo 10 caracteres"]
], [2200, 2700, 2200, 2260]));

children.push(h2("7.3 Función fn_get_quote_pricing"));
children.push(p("Es lo que la app llama al agregar una partida a una cotización. Devuelve el costo y precio sugeridos junto con la base que se usó."));
children.push(code(
`SELECT * FROM rtb.fn_get_quote_pricing(
  p_product_id  := 42,        -- Compresor XS-200
  p_customer_id := 100,       -- ID del cliente
  p_quantity    := 1
);

-- Devuelve:
-- suggested_unit_cost  | suggested_unit_price | cost_basis        | contract_price_id | pricing_source
-- ---------------------+----------------------+-------------------+-------------------+----------------
-- 41286.0000           | 55736.0000           | MOVING_AVG        | NULL              | PRODUCT_DEFAULT`));

children.push(h2("7.4 Trigger de costo promedio"));
children.push(p("Cada vez que entra una recepción de mercancía (movement_type = RECEIPT), el trigger fn_recalc_product_avg_cost recalcula el promedio ponderado de los últimos N meses y actualiza products.current_avg_cost. También deja una fila en product_cost_history."));
children.push(code(
`-- Al insertar:
INSERT INTO inventory_movements (product_id, movement_type, quantity_in, unit_cost, occurred_at)
VALUES (42, 'RECEIPT', 4, 43500, '2026-04-15');

-- El trigger:
--   1. Lee moving_avg_months de products (6 por default)
--   2. Calcula SUM(qty × cost) / SUM(qty) sobre RECEIPTs de últimos 6 meses
--   3. UPDATE products SET current_avg_cost = nuevo_promedio
--   4. INSERT en product_cost_history con previous, new, source_id`));

children.push(h2("7.5 Job nocturno"));
children.push(p("La ventana de 6 meses se mueve cada día. Aunque no entren compras nuevas, el promedio cambia porque las compras viejas salen de la ventana. El job fn_refresh_all_avg_costs() recalcula el promedio de todos los productos activos. Programar diariamente con pg_cron, AWS EventBridge, o un cron de la app:"));
children.push(code(
`-- Cron: 02:00 cada noche
SELECT fn_refresh_all_avg_costs();
-- Devuelve la cantidad de productos cuyo costo cambió.`));

children.push(new Paragraph({ children: [new PageBreak()] }));

// 8. CONVENIOS ARIBA
children.push(h1("8. Convenios Ariba (customer_contract_prices)"));
children.push(pBold("Propósito: precios fijos acordados con clientes específicos. Reemplazan al \"Costo Ariba\" del sistema viejo."));

children.push(h2("8.1 Definición"));
children.push(code(
`CREATE TABLE customer_contract_prices (
    contract_price_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id         BIGINT NOT NULL REFERENCES customers(customer_id),
    product_id          BIGINT NOT NULL REFERENCES products(product_id),
    contract_type       TEXT NOT NULL DEFAULT 'ARIBA'
        CHECK (contract_type IN ('ARIBA','CONTRACT_OTHER')),
    fixed_sale_price    NUMERIC(14,4) NOT NULL CHECK (fixed_sale_price >= 0),
    currency            CHAR(3) NOT NULL DEFAULT 'MXN',
    valid_from          DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to            DATE,
    is_current          BOOLEAN NOT NULL DEFAULT TRUE,
    last_change_notice  TEXT,
    last_changed_by     BIGINT REFERENCES users(user_id),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);`));

children.push(h2("8.2 Campos"));
children.push(makeTable([
  ["Campo","Tipo","Notas"],
  ["customer_id","BIGINT","Cliente con el convenio."],
  ["product_id","BIGINT","Producto al que aplica."],
  ["contract_type","TEXT","ARIBA por default. CONTRACT_OTHER reservado para futuros tipos."],
  ["fixed_sale_price","NUMERIC(14,4)","Precio que se cobra. Sin cálculo, sin margen, sin nada — es lo que está acordado."],
  ["currency","CHAR(3)","Moneda."],
  ["valid_from / valid_to","DATE","Vigencia. valid_to NULL = vigente indefinido."],
  ["is_current","BOOLEAN","Para distinguir convenios vigentes de los archivados."],
  ["last_change_notice","TEXT","Texto libre con la referencia al aviso del cliente: 'Notificado por correo el YYYY-MM-DD, asunto X'."],
  ["last_changed_by","BIGINT","FK a users — quién registró el cambio."]
], [2300, 1700, 5360]));

children.push(h2("8.3 Reglas operativas"));
children.push(bullet("Solo el rol con permiso customer_contract_price.manage (típicamente ACCOUNTING o ADMIN) puede modificar precios Ariba."));
children.push(bullet("Cualquier cambio en fixed_sale_price requiere documentar en last_change_notice (texto del aviso)."));
children.push(bullet("Para cambiar precio: cerrar el convenio actual (is_current=FALSE, valid_to=hoy-1) y crear uno nuevo (valid_from=hoy)."));
children.push(bullet("Cualquier modificación queda en audit_log automáticamente vía trigger."));
children.push(bullet("Para deshabilitar temporalmente un convenio: is_current=FALSE. La función de pricing dejará de seleccionarlo."));

children.push(h2("8.4 Cómo se llena (ejemplo)"));
children.push(code(
`-- Convenio nuevo con Cliente Bimbo para el Compresor XS-200
INSERT INTO customer_contract_prices (
    customer_id, product_id, contract_type,
    fixed_sale_price, valid_from, last_change_notice, last_changed_by
)
SELECT c.customer_id, p.product_id, 'ARIBA',
       51300.00, CURRENT_DATE,
       'Convenio firmado 2026-04-15. Correo de Cliente Bimbo, ref. ARIBA-2026-1234.',
       (SELECT user_id FROM users WHERE email = 'maria@rtb.com')
FROM customers c, products p
WHERE c.code = 'BIMBO' AND p.sku = 'CMP-XS200';`));

children.push(h2("8.5 Cómo se cambia (cuando llega aviso)"));
children.push(code(
`BEGIN;
SET LOCAL rtb.current_user_id = '5';   -- Usuario que recibe el aviso

-- 1. Cerrar el convenio vigente
UPDATE customer_contract_prices
   SET is_current = FALSE, valid_to = CURRENT_DATE - 1, updated_at = now()
 WHERE customer_id = (SELECT customer_id FROM customers WHERE code='BIMBO')
   AND product_id  = (SELECT product_id  FROM products  WHERE sku='CMP-XS200')
   AND is_current  = TRUE;

-- 2. Insertar el nuevo precio
INSERT INTO customer_contract_prices (
    customer_id, product_id, contract_type, fixed_sale_price,
    valid_from, last_change_notice, last_changed_by
)
SELECT c.customer_id, p.product_id, 'ARIBA',
       52800.00, CURRENT_DATE,
       'Aviso del 2026-09-10: incremento por ajuste anual. Ref. ARIBA-2026-9876.',
       5
FROM customers c, products p
WHERE c.code='BIMBO' AND p.sku='CMP-XS200';
COMMIT;`));

children.push(new Paragraph({ children: [new PageBreak()] }));

// 9. PRODUCT_COST_HISTORY
children.push(h1("9. product_cost_history"));
children.push(pBold("Propósito: bitácora inmutable de cada cambio en current_avg_cost."));
children.push(p("Cada vez que el costo promedio de un producto cambia (por una recepción nueva o por el job nocturno), se registra una fila aquí. Permite responder: \"¿cuál era el costo promedio del SKU X cuando se aprobó la cotización 42?\""));

children.push(h2("9.1 Definición"));
children.push(code(
`CREATE TABLE product_cost_history (
    history_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id           BIGINT NOT NULL REFERENCES products(product_id),
    previous_avg_cost    NUMERIC(14,4),
    new_avg_cost         NUMERIC(14,4) NOT NULL,
    quantity_received    NUMERIC(14,4),
    unit_cost_of_receipt NUMERIC(14,4),
    triggered_by         TEXT NOT NULL CHECK (triggered_by IN
        ('GOODS_RECEIPT','OPENING_BALANCE','MANUAL_RECALC','NIGHTLY_REFRESH')),
    source_id            BIGINT,
    recorded_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);`));

children.push(h2("9.2 Consultas típicas"));
children.push(h3("Histórico de costo de un producto"));
children.push(code(
`SELECT recorded_at, previous_avg_cost, new_avg_cost, triggered_by
FROM product_cost_history
WHERE product_id = 42
ORDER BY recorded_at DESC LIMIT 20;`));

children.push(h3("Costo vigente en una fecha pasada"));
children.push(code(
`SELECT new_avg_cost
FROM product_cost_history
WHERE product_id = 42 AND recorded_at <= '2026-03-15'
ORDER BY recorded_at DESC LIMIT 1;`));

children.push(new Paragraph({ children: [new PageBreak()] }));

// 10. EJEMPLO COMPLETO
children.push(h1("10. Ejemplo numérico completo"));
children.push(p("Recorrido extremo a extremo de cómo viaja el costo y el precio para el Compresor XS-200 (categoría Neumática, margen 35%, ventana 6 meses)."));

children.push(h2("10.1 Compras históricas registradas"));
children.push(makeTable([
  ["Fecha","Cantidad","Costo unit.","Subtotal","Proveedor"],
  ["2025-12-10","5","$40,000","$200,000","Proveedor A"],
  ["2026-01-15","3","$42,000","$126,000","Proveedor B"],
  ["2026-02-20","2","$39,000","$78,000","Proveedor A"],
  ["2026-03-25","4","$43,500","$174,000","Proveedor C"]
], [1500, 1500, 1800, 2000, 2560]));

children.push(h2("10.2 Cálculo del promedio móvil de 6 meses (al 2026-04-25)"));
children.push(code(
`Total cantidad: 5 + 3 + 2 + 4 = 14 unidades
Total costo:    200,000 + 126,000 + 78,000 + 174,000 = $578,000

current_avg_cost = 578,000 / 14 = $41,285.71`));

children.push(h2("10.3 Precio sugerido para un cliente sin convenio"));
children.push(code(
`MOVING_AVG strategy + categoría Neumática (35%):
Precio sugerido = 41,285.71 × 1.35 = $55,735.71`));

children.push(h2("10.4 Mismo cliente con descuento de 5% en cotización"));
children.push(code(
`unit_price_sale (en quote_items)  = 55,735.71
discount_pct                       = 5
subtotal calculado:
  cantidad × unit_price_sale × (1 - discount/100)
  1 × 55,735.71 × 0.95 = $52,948.92`));

children.push(h2("10.5 Cliente Bimbo (con convenio Ariba)"));
children.push(code(
`fn_get_quote_pricing detecta el convenio:
  fixed_sale_price = $51,300 (ya acordado)
  cost_basis = 'CONTRACT_FIXED'
  contract_price_id = 7

unit_price_sale = $51,300, sin importar el costo o el margen.`));

children.push(h2("10.6 Cotización urgente con proveedor nuevo"));
children.push(p("El cliente pide 1 pieza adicional pero ningún proveedor histórico tiene stock. Compras encuentra al Proveedor Z que cobra $52,000. Para que la cotización sea sostenible, el vendedor sustituye el costo:"));
children.push(code(
`En la pantalla de cotización, el vendedor cambia:
  cost_basis              = 'SUPPLIER_SPECIFIC'
  unit_cost_purchase      = 52,000
  cost_source_supplier_id = ID del Proveedor Z
  cost_override_reason    = 'Compra urgente. Proveedores A/B/C sin stock.
                            Proveedor Z único disponible para entrega 48h.'

Precio recalculado: 52,000 × 1.35 = $70,200`));

children.push(h2("10.7 Recepción nueva y efecto en futuras cotizaciones"));
children.push(p("Llega una nueva recepción del Proveedor A a $40,500 por 6 piezas:"));
children.push(code(
`El trigger recalcula:
Nuevo total cantidad: 14 + 6 = 20
Nuevo total costo:    578,000 + 243,000 = $821,000
Nuevo current_avg_cost: 821,000 / 20 = $41,050

Precio sugerido para clientes nuevos: 41,050 × 1.35 = $55,417.50

Cotización Ariba (Bimbo): NO se afecta. Sigue $51,300.
Cotizaciones ya enviadas: NO se afectan (snapshot al cotizar).
Cotizaciones nuevas: usan el nuevo $55,417.50.

product_cost_history registra:
  previous_avg_cost = 41,285.71
  new_avg_cost      = 41,050.00
  quantity_received = 6
  unit_cost_of_receipt = 40,500
  triggered_by      = 'GOODS_RECEIPT'`));

children.push(new Paragraph({ children: [new PageBreak()] }));

// 11. RELACIÓN CON SEGURIDAD Y AUDITORÍA
children.push(h1("11. Relación con el módulo de Seguridad y Auditoría"));

children.push(h2("11.1 Permisos involucrados"));
children.push(makeTable([
  ["Permiso","Qué controla"],
  ["product.view","Leer cualquier tabla de productos."],
  ["product.manage","INSERT/UPDATE en products, brands, categories, attributes, configurations, BOM."],
  ["customer_contract_price.manage","INSERT/UPDATE en customer_contract_prices (típicamente ACCOUNTING o ADMIN)."],
  ["quote.create / quote.edit","Crear y modificar quote_items con override de costo."],
  ["inventory.adjust","Insertar inventory_movements manualmente (afecta el costo promedio)."]
], [3500, 5860]));

children.push(h2("11.2 Auditoría automática"));
children.push(p("Las siguientes tablas tienen activado fn_audit_changes (definido en 04_views_and_triggers.sql):"));
children.push(bullet("products — cambios en estrategia, ventana, categoría."));
children.push(bullet("categories — cambios en margen (impacto enorme en precios)."));
children.push(bullet("customer_contract_prices — cualquier cambio en convenios Ariba."));
children.push(bullet("quote_items — al hacer override SUPPLIER_SPECIFIC o MANUAL_OVERRIDE."));
children.push(p("product_cost_history NO se audita: ya es bitácora por sí misma. inventory_movements solo se audita en INSERT (es append-only)."));

children.push(h2("11.3 Consultas de seguridad útiles"));
children.push(h3("¿Quién subió el margen de Neumática y cuándo?"));
children.push(code(
`SELECT a.changed_at, u.full_name,
       (a.before_data->>'profit_margin_pct')::NUMERIC AS de,
       (a.after_data->>'profit_margin_pct')::NUMERIC  AS a_que
FROM audit_log a
LEFT JOIN users u ON u.user_id = a.user_id
WHERE a.entity_type = 'categories'
  AND (a.before_data->>'name') = 'Neumática'
  AND a.action = 'UPDATE'
  AND (a.before_data->>'profit_margin_pct') IS DISTINCT FROM (a.after_data->>'profit_margin_pct')
ORDER BY a.changed_at DESC;`));

children.push(h3("Cotizaciones con override de costo en el último mes"));
children.push(code(
`SELECT q.quote_number, c.business_name, qi.line_number, qi.cost_basis,
       qi.unit_cost_purchase, qi.cost_override_reason, u.full_name AS vendedor
FROM quote_items qi
JOIN quotes q     ON q.quote_id = qi.quote_id
JOIN customers c  ON c.customer_id = q.customer_id
LEFT JOIN users u ON u.user_id = q.sales_rep_id
WHERE qi.cost_basis IN ('SUPPLIER_SPECIFIC','MANUAL_OVERRIDE')
  AND q.created_at >= now() - INTERVAL '30 days'
ORDER BY q.created_at DESC;`));

// 12. MIGRACIÓN
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1("12. Migración desde Notion"));

children.push(p("Pasos específicos para este módulo, en orden:"));

children.push(numList("Cargar categorías. El equipo comercial debe entregar la matriz de margen por categoría. Ejecutar INSERT con profit_margin_pct."));
children.push(numList("Cargar marcas desde property_marca[0]."));
children.push(numList("Cargar productos desde el Catálogo de Productos. Para cada uno: lookup brand_id, category_id, sat_product_key_id."));
children.push(numList("Marcar productos PASSTHROUGH: el equipo de ventas debe entregar la lista de SKUs que se venden al costo (probablemente refacciones específicas)."));
children.push(numList("Definir atributos y BOM. Esto NO existe en Notion. Tomar de hojas Excel del equipo de ingeniería."));
children.push(numList("Cargar inventario inicial como inventory_movements tipo OPENING_BALANCE con el costo conocido al corte. Esto dispara el trigger y deja current_avg_cost con valor."));
children.push(numList("Cargar convenios Ariba: el área comercial debe entregar la lista de cliente × producto × precio acordado."));
children.push(numList("Validar comparando precios: SELECT v_product_pricing contra los precios de Notion. Si difieren mucho, revisar caso por caso."));

children.push(h2("12.1 Validación final"));
children.push(code(
`-- Productos sin costo conocido (no han tenido OPENING_BALANCE ni RECEIPT)
SELECT product_id, sku, name FROM products
WHERE current_avg_cost IS NULL AND is_active;

-- Productos PASSTHROUGH con margen aplicable (señal de mal seteo)
-- En PASSTHROUGH no se aplica margen, pero la categoría sigue teniendo profit_margin_pct
-- Esto es informativo, no error
SELECT p.sku, c.profit_margin_pct, p.pricing_strategy
FROM products p JOIN categories c ON c.category_id = p.category_id
WHERE p.pricing_strategy = 'PASSTHROUGH';

-- Convenios Ariba duplicados (mismo cliente+producto vigente más de uno)
SELECT customer_id, product_id, COUNT(*)
FROM customer_contract_prices WHERE is_current = TRUE
GROUP BY customer_id, product_id HAVING COUNT(*) > 1;`));

const doc = new Document({
  creator: "Sistema RTB",
  title: "Módulo de Productos y Pricing",
  description: "Documentación detallada del módulo de productos y pricing",
  styles: {
    default: { document: { run: { font: ARIAL, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: ARIAL, color: COLOR_DARK },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: ARIAL, color: COLOR_DARK },
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
          children: [new TextRun({ text: "RTB · Productos y Pricing", font: ARIAL, size: 18, color: COLOR_GRAY })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Página ", font: ARIAL, size: 18, color: COLOR_GRAY }),
            new TextRun({ children: [PageNumber.CURRENT], font: ARIAL, size: 18, color: COLOR_GRAY })
          ]
        })]
      })
    },
    children
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/sessions/bold-dazzling-brahmagupta/mnt/outputs/rtb/09_modulo_productos_pricing.docx", buf);
  console.log("DOCX listo:", buf.length, "bytes");
});

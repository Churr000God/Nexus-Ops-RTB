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

// PORTADA
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 240 },
  children: [new TextRun({ text: "Estructura de", font: ARIAL, size: 56, bold: true })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
  children: [new TextRun({ text: "Navegación del Sistema", font: ARIAL, size: 56, bold: true })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360, after: 120 },
  children: [new TextRun({ text: "Sistema RTB · Pestañas, menús y acciones por rol", font: ARIAL, size: 22, color: GRAY })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 },
  children: [new TextRun({ text: "Documento de UX / arquitectura de información · v1.0", font: ARIAL, size: 22, color: GRAY })] }));
ch.push(new Paragraph({ children: [new PageBreak()] }));

// 1. INTRO
ch.push(h1("1. Introducción"));
ch.push(p("Este documento define la estructura de navegación del sistema RTB. Para cada módulo se especifica: pestañas principales, sub-pestañas, acciones disponibles, y los permisos requeridos. También incluye la vista del menú según el rol del usuario."));
ch.push(p("La estructura está pensada para una aplicación web con menú lateral persistente y área de trabajo central. Funciona igual en SPA (React/Vue) o multi-página tradicional."));

ch.push(h2("1.1 Convenciones de notación"));
ch.push(makeTable([
  ["Símbolo","Significado"],
  ["📁","Módulo de primer nivel"],
  ["└─","Pestaña dentro del módulo"],
  ["•","Acción / botón / link dentro de una pestaña"],
  ["[PERM]","Permiso requerido"],
  ["⚙️","Solo ADMIN"]
], [1500, 7860]));

ch.push(h2("1.2 Nivel jerárquico"));
ch.push(p("La navegación tiene tres niveles:"));
ch.push(numList("Módulo: aparece en el menú lateral (Ventas, Compras, Inventario, etc.)"));
ch.push(numList("Pestaña: cuando entras a un módulo, ves un grupo de pestañas (Lista | Crear | Reportes)"));
ch.push(numList("Acción: dentro de una pestaña, botones / links / dropdowns que ejecutan operaciones"));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 2. MAPA GENERAL
ch.push(h1("2. Mapa general del menú"));
ch.push(p("Estructura del sidebar — los 14 módulos principales. El usuario solo ve los que su rol le permita."));
ch.push(code(
`┌─────────────────────────────────────┐
│  🏠 Inicio (dashboard ejecutivo)    │  ← Todos los roles
│                                     │
│  📊 Ventas                          │  SALES, ADMIN
│  └─ Cotizaciones                    │
│  └─ Notas de remisión               │
│  └─ Pedidos                         │
│  └─ Reportes de ventas              │
│                                     │
│  🚚 Logística                       │  WAREHOUSE, ADMIN
│  └─ Empacado                        │
│  └─ Envíos                          │
│  └─ Rutas                           │
│  └─ Fleteras                        │
│                                     │
│  🛒 Compras                         │  PURCHASING, ADMIN
│  └─ Solicitudes de material         │
│  └─ Órdenes de compra               │
│  └─ Recepciones                     │
│  └─ Facturas de proveedor           │
│  └─ Gastos operativos               │
│                                     │
│  📦 Inventario                      │  WAREHOUSE, ADMIN, otros (lectura)
│  └─ Stock actual                    │
│  └─ Movimientos                     │
│  └─ KPIs (ABC, alertas)             │
│  └─ No conformes                    │
│  └─ Snapshots / cierres             │
│                                     │
│  💻 Equipos (assets)                │  WAREHOUSE, ADMIN
│  └─ Lista                           │
│  └─ Cambios de pieza                │
│  └─ Historial                       │
│                                     │
│  👥 Clientes                        │  SALES, ADMIN, ACCOUNTING (lectura)
│  └─ Lista                           │
│  └─ Convenios Ariba                 │
│                                     │
│  🏭 Proveedores                     │  PURCHASING, ADMIN, otros
│  └─ Lista                           │
│  └─ Catálogo de productos prov.     │
│                                     │
│  📋 Catálogos                       │  ADMIN
│  └─ Productos                       │
│  └─ Marcas                          │
│  └─ Categorías (con margen)         │
│                                     │
│  🧾 Facturación (CFDI)              │  ACCOUNTING, ADMIN
│  └─ CFDIs emitidos                  │
│  └─ Emitir nuevo                    │
│  └─ Complementos de pago            │
│  └─ Notas de crédito                │
│  └─ Cancelaciones                   │
│  └─ Bitácora PAC                    │
│                                     │
│  💰 Cobranza / Finanzas             │  ACCOUNTING, ADMIN
│  └─ Cuentas por cobrar (AR)         │
│  └─ Cuentas por pagar (AP)          │
│  └─ Pagos recibidos                 │
│  └─ Pagos sin aplicar               │
│  └─ Flujo de caja proyectado        │
│                                     │
│  📈 Reportes                        │  Según rol                                 │
│  └─ Comercial                       │
│  └─ Margen y rentabilidad           │
│  └─ Operación                       │
│  └─ Financiero                      │
│                                     │
│  ⚙️ Administración                  │  ADMIN
│  └─ Usuarios                        │
│  └─ Roles y permisos                │
│  └─ Configuración fiscal (CFDI)     │
│  └─ Series y folios                 │
│  └─ Catálogos SAT                   │
│  └─ Auditoría (audit_log)           │
│                                     │
│  👤 Mi cuenta                       │  Todos los roles
│  └─ Mi perfil                       │
│  └─ Cambiar password                │
│  └─ Mis sesiones                    │
└─────────────────────────────────────┘`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 3. MÓDULO ADMINISTRACIÓN
ch.push(h1("3. Módulo Administración ⚙️"));
ch.push(pItalic("Acceso exclusivo del rol ADMIN."));

ch.push(h2("3.1 Pestaña: Usuarios"));
ch.push(makeTable([
  ["Vista / acción","Descripción","Permiso"],
  ["Lista de usuarios","Tabla con email, nombre, roles, estatus, último login","user.view"],
  ["Botón: Nuevo usuario","Form con email, nombre, password temporal, roles iniciales","user.manage"],
  ["Acción: Editar usuario","Cambiar nombre, email, roles","user.manage"],
  ["Acción: Desactivar usuario","Set is_active=FALSE (no DELETE)","user.manage"],
  ["Acción: Resetear password","Genera token, envía email","user.manage"],
  ["Acción: Reactivar usuario","Volver is_active=TRUE","user.manage"],
  ["Filtro: Mostrar inactivos","Toggle en la tabla","user.view"]
], [3000, 4500, 1860]));

ch.push(h2("3.2 Pestaña: Roles y permisos"));
ch.push(makeTable([
  ["Vista / acción","Descripción","Permiso"],
  ["Lista de roles","ADMIN, SALES, PURCHASING, WAREHOUSE, ACCOUNTING + custom","role.manage"],
  ["Detalle de rol","Lista de permisos asignados (matriz role_permissions)","role.manage"],
  ["Acción: Crear rol nuevo","code, name, description","role.manage"],
  ["Acción: Asignar permisos","Checkbox grid de los ~40 permisos disponibles","role.manage"],
  ["Acción: Asignar usuarios al rol","Multi-select de users","role.manage"]
], [3000, 4500, 1860]));

ch.push(h2("3.3 Pestaña: Configuración fiscal (emisor)"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Datos del emisor","RFC, razón social, régimen, CP fiscal, lugar de expedición"],
  ["CSD (certificado)","Subir .cer y .key, almacenar password en vault, validar fechas"],
  ["PAC (timbrado)","Provider, endpoint, credenciales, ambiente (SANDBOX/PRODUCTION)"],
  ["Acción: Probar conexión PAC","Test de timbrado con CFDI dummy"],
  ["Histórico de configs","Cuando se cierra una config y se abre otra (renovar CSD)"]
], [3000, 6360]));

ch.push(h2("3.4 Pestaña: Series y folios"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Lista de series","series, cfdi_type, descripción, next_folio, is_active"],
  ["Acción: Nueva serie","Definir code (A, NC, CP, EXP), tipo, descripción"],
  ["Acción: Activar/desactivar","Toggle is_active"],
  ["Visualización: folios consumidos","Gráfica del consumo por serie por mes"]
], [3000, 6360]));

ch.push(h2("3.5 Pestaña: Catálogos SAT"));
ch.push(p("Vista de los catálogos oficiales del SAT cargados en la BD. Sirve para verificar versión y recargar cuando el SAT publique actualizaciones."));
ch.push(bullet("Claves Producto/Servicio (sat_product_keys)"));
ch.push(bullet("Claves Unidad (sat_unit_keys)"));
ch.push(bullet("Régimen fiscal (sat_tax_regimes)"));
ch.push(bullet("Uso de CFDI (sat_cfdi_uses)"));
ch.push(bullet("Forma de pago (sat_payment_forms)"));
ch.push(bullet("Método de pago (sat_payment_methods)"));
ch.push(bullet("Acción: Importar nuevo catálogo (CSV oficial SAT)"));

ch.push(h2("3.6 Pestaña: Auditoría (audit_log)"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Log de cambios","Filtrable por entidad, usuario, fecha, acción"],
  ["Detalle de un cambio","JSONB before vs after en formato diff"],
  ["Buscar por entidad+id","Ver toda la historia de un quote, order, cfdi específico"],
  ["Buscar por usuario","Qué hizo Juan en el último mes"]
], [3000, 6360]));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 4. MÓDULO CATÁLOGOS
ch.push(h1("4. Módulo Catálogos 📋"));

ch.push(h2("4.1 Pestaña: Productos"));
ch.push(makeTable([
  ["Vista / acción","Descripción","Permiso"],
  ["Lista de productos","Filtros: SKU, nombre, marca, categoría, is_saleable, is_active","product.view"],
  ["Botón: Nuevo producto","Form completo: SKU, nombre, descripción, marca, categoría, claves SAT, is_saleable, is_configurable, is_assembled, min_stock","product.manage"],
  ["Detalle de producto","Tabs: Datos generales | Atributos | BOM | Precios y costos | Histórico de costo | Stock actual","product.view"],
  ["Tab: Atributos","Definir atributos configurables (Voltaje, Color, etc.) si is_configurable","product.manage"],
  ["Tab: BOM","Definir partes (con quantity) si is_assembled","product.manage"],
  ["Tab: Precios y costos","Ver pricing_strategy, current_avg_cost, precio sugerido","product.view"],
  ["Tab: Histórico de costo","Línea de tiempo de cambios en avg_cost","product.view"],
  ["Tab: Stock actual","Cantidad, valor, semáforo, demanda 90/180","product.view"],
  ["Acción: Desactivar producto","is_active = FALSE","product.manage"],
  ["Filtro: Solo internos","is_saleable = FALSE","product.view"],
  ["Filtro: Solo vendibles","is_saleable = TRUE","product.view"]
], [2500, 5500, 1360]));

ch.push(h2("4.2 Pestaña: Marcas"));
ch.push(p("CRUD simple — alta, edición, desactivación de marcas. Permiso: product.manage."));

ch.push(h2("4.3 Pestaña: Categorías"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Árbol jerárquico","Vista expandible/colapsable de categorías padre/hijo"],
  ["Detalle","Nombre, slug, profit_margin_pct, parent_id"],
  ["Acción: Nueva categoría","Con margen — IMPORTANTE: afecta precio de venta de todos los productos de esta categoría"],
  ["Acción: Cambiar margen","Confirma con WARNING: esto afectará los precios sugeridos a partir de hoy"],
  ["Visualización","Distribución de productos por categoría"]
], [3000, 6360]));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 5. MÓDULO CLIENTES
ch.push(h1("5. Módulo Clientes 👥"));

ch.push(h2("5.1 Pestaña: Lista"));
ch.push(makeTable([
  ["Vista / acción","Descripción","Permiso"],
  ["Tabla","Filtros: code, business_name, locality, is_active. Columnas: revenue YTD, días sin compra","customer.view"],
  ["Botón: Nuevo cliente","Form: code, business_name, customer_type, locality, payment_terms_days, credit_limit","customer.manage"],
  ["Detalle (tabs)","Datos | Datos fiscales (multi-RFC) | Direcciones | Contactos | Convenios Ariba | Histórico | Estado de cuenta","customer.view"]
], [2500, 5500, 1360]));

ch.push(h2("5.2 Sub-tabs del detalle de cliente"));
ch.push(makeTable([
  ["Tab","Contenido"],
  ["Datos generales","code, business_name, customer_type, locality, terms, credit_limit, currency, notes"],
  ["Datos fiscales","Multi-RFC: lista de tax_data con RFC, razón social, régimen, uso CFDI default, CP. Botón: Agregar RFC"],
  ["Direcciones","Lista de FISCAL (con tax_data_id) y DELIVERY. Botón: Nueva dirección"],
  ["Contactos","Lista con full_name, role_title, email, phone, is_primary. Botón: Nuevo contacto"],
  ["Convenios Ariba","Productos con precio fijo acordado. Botón: Agregar convenio (lleva a customer_contract_prices)"],
  ["Histórico","Cotizaciones, pedidos, CFDIs, NRs ordenados cronológicamente"],
  ["Estado de cuenta","Aging: bucket_0_30, 31_60, 61_90, 90_plus. Pagos recibidos. Saldo actual"]
], [2400, 6960]));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 6. MÓDULO PROVEEDORES
ch.push(h1("6. Módulo Proveedores 🏭"));

ch.push(h2("6.1 Pestaña: Lista"));
ch.push(makeTable([
  ["Vista / acción","Descripción","Permiso"],
  ["Tabla","Filtros: code, supplier_type (GOODS/SERVICES/BOTH), locality, is_occasional, is_active","supplier.view"],
  ["Botón: Nuevo proveedor","Con flag is_occasional para registros mínimos","supplier.manage"]
], [2500, 5500, 1360]));

ch.push(h2("6.2 Sub-tabs del detalle"));
ch.push(makeTable([
  ["Tab","Contenido"],
  ["Datos generales","code, business_name, supplier_type, locality, is_occasional, payment_terms, avg_payment_time"],
  ["Datos fiscales","RFC, razón social, régimen, CP"],
  ["Direcciones","FISCAL, PICKUP, OTHER"],
  ["Contactos","Lista de contactos"],
  ["Catálogo","Productos que vende el proveedor (supplier_products) con precio histórico"],
  ["Histórico de OCs","Lista de purchase_orders con su evolución"],
  ["Estado de cuenta","Facturas pendientes, aging AP, total pagado YTD"],
  ["Performance","On-time delivery %, lead time real vs estimado, NCs registradas"]
], [2400, 6960]));

ch.push(h2("6.3 Pestaña: Catálogo de productos del proveedor"));
ch.push(p("Vista global cross-proveedor: para cada SKU, qué proveedores lo venden y a qué precio. Útil al evaluar opciones."));
ch.push(code(
`Tabla:
SKU       | Producto         | Proveedor    | Precio  | Lead time | MOQ | Vigente
CIL-FE-50 | Cilindro 50mm    | Festo MX    | $2,100  | 14 días   | 1   | ✓
CIL-FE-50 | Cilindro 50mm    | SMC         | $1,950  | 21 días   | 5   | ✓`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 7. MÓDULO VENTAS
ch.push(h1("7. Módulo Ventas 📊"));

ch.push(h2("7.1 Pestaña: Cotizaciones"));
ch.push(makeTable([
  ["Vista / acción","Descripción","Permiso"],
  ["Lista","Filtros: status (DRAFT/SENT/APPROVED/REJECTED/CANCELLED/EXPIRED), cliente, vendedor, fecha","quote.view"],
  ["Kanban","Columnas por status — drag para cambiar (con permisos correspondientes)","quote.view"],
  ["Botón: Nueva cotización","Wizard: cliente → dirección entrega → partidas → revisión","quote.create"],
  ["Detalle","Tabs: General | Partidas | Bitácora de estados | Documentos","quote.view"],
  ["Acción: Editar","Solo si status=DRAFT","quote.edit"],
  ["Acción: Enviar","DRAFT → SENT, opcionalmente envía email","quote.send"],
  ["Acción: Aprobar","SENT → APPROVED (dispara creación de orden)","quote.approve"],
  ["Acción: Cancelar","Cualquier status → CANCELLED, requiere motivo","quote.cancel"],
  ["Acción: Duplicar","Copia para cotización similar","quote.create"]
], [2500, 5500, 1360]));

ch.push(h2("7.2 Wizard: Nueva cotización"));
ch.push(numList("Paso 1: Seleccionar cliente (autocomplete sobre customers)"));
ch.push(numList("Paso 2: Elegir RFC (si tiene varios) y dirección de entrega"));
ch.push(numList("Paso 3: Agregar partidas — buscar producto, ver precio sugerido (calculado desde fn_get_quote_pricing), captar cantidad y descuento"));
ch.push(numList("  • Si producto configurable: abrir sub-form para elegir atributos"));
ch.push(numList("  • Si hay convenio Ariba: muestra el precio fijo y lo aplica automáticamente"));
ch.push(numList("  • Si vendedor sustituye costo: capturar cost_basis (SUPPLIER_SPECIFIC/MANUAL_OVERRIDE) y reason obligatoria"));
ch.push(numList("Paso 4: Revisión: subtotal, IVA, descuento global, total. Términos de pago, vigencia"));
ch.push(numList("Paso 5: Guardar como DRAFT o Enviar directo"));

ch.push(h2("7.3 Pestaña: Notas de remisión"));
ch.push(makeTable([
  ["Vista / acción","Descripción","Permiso"],
  ["Lista","Filtros: status (DRAFT/ISSUED/DELIVERED/TRANSFORMED/INVOICED/CANCELLED), cliente, fecha","quote.view"],
  ["Botón: Nueva NR","Form similar a cotización pero informal","quote.create (o nuevo permiso delivery_note.create)"],
  ["Detalle","Tabs: General | Items | Cotizaciones asociadas (junction) | Documentos","quote.view"],
  ["Acción: Marcar entregada","ISSUED → DELIVERED + capturar fecha física","quote.edit"],
  ["Acción: Convertir a cotización formal","Cuando llega OC del cliente, crear quote y vincular vía quote_delivery_notes","quote.create"],
  ["Acción: Consolidar varias NRs","Seleccionar varias y crear UNA quote que las cubra todas","quote.create"]
], [2500, 5500, 1360]));

ch.push(h2("7.4 Pestaña: Pedidos"));
ch.push(makeTable([
  ["Vista / acción","Descripción","Permiso"],
  ["Lista","Filtros: status, payment_status, invoice_status, has_shortage, packing_status, cliente","order.view"],
  ["Detalle","Tabs: General | Items | Hitos (milestones) | Envíos | Pagos | CFDIs","order.view"],
  ["Tab Items","Cantidades: ordered, packed, shipped, invoiced. Avance % por partida","order.view"],
  ["Tab Hitos","Timeline visual de order_milestones (CREATED, APPROVED, SHIPPED, etc.)","order.view"],
  ["Tab Envíos","Lista de shipments del pedido con tracking","order.view"],
  ["Tab Pagos","payment_applications aplicados a este pedido","order.view"],
  ["Tab CFDIs","Facturas emitidas para este pedido","order.view"],
  ["Acción: Cancelar","Solo si no está SHIPPED","order.cancel"]
], [2500, 5500, 1360]));

ch.push(h2("7.5 Pestaña: Reportes de ventas"));
ch.push(bullet("Ventas por período (mensual/trimestral/anual) — v_sales_by_period"));
ch.push(bullet("Top clientes — v_top_customers"));
ch.push(bullet("Conversión de cotizaciones — v_quote_conversion"));
ch.push(bullet("Performance por vendedor — v_sales_rep_performance"));
ch.push(bullet("Margen por producto / categoría / cliente"));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 8. MÓDULO LOGÍSTICA
ch.push(h1("8. Módulo Logística 🚚"));

ch.push(h2("8.1 Pestaña: Empacado"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Cola de pedidos a empacar","Filtra orders con status=PENDING o PARTIALLY_PACKED, ordenados por order_date"],
  ["Detalle de empacado","Lista de partidas con quantity_ordered y quantity_packed, input para registrar empacado"],
  ["Acción: Asignar packer","Set assigned_packer_user_id"],
  ["Acción: Marcar como READY","Cuando todas las partidas están empacadas, packing_status=READY"],
  ["Visualización: avance global","v_order_packing_progress con % completado por pedido"]
], [3000, 6360]));

ch.push(h2("8.2 Pestaña: Envíos (shipments)"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Lista","Filtros: status, fecha, fletera. Columnas: shipment_number, order, customer, carrier, tracking, status"],
  ["Botón: Crear envío","Para un pedido READY: elegir items, fletera, dirección"],
  ["Detalle","Tabs: General | Items | Tracking events | Evidencia"],
  ["Tab Tracking","Línea de tiempo de shipment_tracking_events"],
  ["Acción: Registrar evento","Capturar location, status_code, description"],
  ["Acción: Marcar entregado","status=DELIVERED, capturar received_by_name, foto/firma evidencia"],
  ["Acción: Reportar incidente","status=INCIDENT, capturar incident_notes"]
], [3000, 6360]));

ch.push(h2("8.3 Pestaña: Rutas"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Calendario","Vista por día con rutas planeadas"],
  ["Botón: Nueva ruta","Crear con conductor, vehículo, fecha"],
  ["Detalle","Tabs: General | Paradas | Mapa | Resumen"],
  ["Tab Paradas","Lista ordenada de DELIVERY (shipments) y PICKUP (POs). Drag para reordenar"],
  ["Tab Mapa","Visualización geográfica con direcciones y orden de visita"],
  ["Acción: Asignar conductor","Set driver_user_id, status=ASSIGNED"],
  ["Acción: Iniciar ruta","status=IN_PROGRESS, capturar start_time"],
  ["Acción: Cerrar ruta","Capturar end_time, total_distance_km. status=COMPLETED"],
  ["Vista del conductor","Mobile-first: lista de paradas, marcar arrived/completed, agregar notas"]
], [3000, 6360]));

ch.push(h2("8.4 Pestaña: Fleteras (carriers)"));
ch.push(p("CRUD: fleteras propias (is_internal=TRUE) y externas (FedEx, DHL, Estafeta…) con sus URLs de tracking."));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 9. MÓDULO COMPRAS
ch.push(h1("9. Módulo Compras 🛒"));

ch.push(h2("9.1 Pestaña: Solicitudes de material (PR)"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Lista","Filtros: status (DRAFT/APPROVED/PARTIALLY_ORDERED/ORDERED/REJECTED/CANCELLED), solicitante"],
  ["Botón: Nueva PR","Wizard: motivo → items (mezclar GOODS_RESALE, GOODS_INTERNAL, SERVICE)"],
  ["Detalle","Lista de items con item_type, producto/descripción, cantidad, proveedor sugerido"],
  ["Acción: Aprobar","DRAFT → APPROVED (requiere permiso purchase_request.approve)"],
  ["Acción: Convertir a OC","Crear PO con items seleccionados, vincular request_item_id"],
  ["Acción: Rechazar","DRAFT → REJECTED con motivo"]
], [3000, 6360]));

ch.push(h2("9.2 Pestaña: Órdenes de compra (PO)"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Lista","Filtros: status, supplier, po_type (GOODS/SERVICES/MIXED)"],
  ["Botón: Nueva PO","Wizard: proveedor → po_type → items (de PR aprobada o nuevo) → totales → enviar"],
  ["Detalle","Tabs: General | Items | Recepciones | Facturas | Pagos"],
  ["Acción: Enviar al proveedor","DRAFT → SENT, opcionalmente email automático"],
  ["Acción: Confirmar","CONFIRMED (trigger valida que tiene items vinculados a PR si po_type=GOODS)"],
  ["Acción: Marcar recibido","Lleva a crear goods_receipt"],
  ["Acción: Imprimir","Genera PDF de la OC para el proveedor"]
], [3000, 6360]));

ch.push(h2("9.3 Pestaña: Recepciones (GR)"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Lista","Filtros: fecha, supplier, validation status"],
  ["Botón: Nueva recepción","Para PO confirmada: capturar cantidades recibidas, costo, validación física"],
  ["Detalle","Items recibidos con quantity_received y unit_cost, validación, evidencia"],
  ["Acción: Validar físicamente","physical_validation=TRUE, validated_by, validated_at"],
  ["Acción: Reportar no conforme","Crea non_conformity con nc_source=SUPPLIER y adjustment_type=OUT"],
  ["Auto: Trigger inventory_movement","Sube stock automáticamente vía fn_create_inv_movement_from_receipt"]
], [3000, 6360]));

ch.push(h2("9.4 Pestaña: Facturas de proveedor"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Lista","Filtros: status, payment_status, supplier, aging_bucket"],
  ["Botón: Capturar factura","Form: # factura, UUID SAT, fechas, totales, sat_payment_form_id, sat_payment_method_id"],
  ["Detalle","Items con item_type, vinculación a PO items, vinculación a GR"],
  ["Acción: Validar","RECEIVED → VALIDATED (verifica contra PO y GR)"],
  ["Acción: Marcar pagada","Trigger fn_validate_invoice_chain valida que tenga GR si invoice_type=GOODS/MIXED"],
  ["Acción: Cargar XML del proveedor","Si llega CFDI, parsear UUID y valores"]
], [3000, 6360]));

ch.push(h2("9.5 Pestaña: Gastos operativos"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Lista","Filtros: category, fecha, status. Columnas: concept, supplier, total, deductible"],
  ["Botón: Nuevo gasto","Form: concepto, categoría, supplier (opcional), UUID SAT, sat_payment_form/method, total"],
  ["Acción: Marcar pagado","status=PAID con payment_date"]
], [3000, 6360]));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 10. MÓDULO INVENTARIO
ch.push(h1("10. Módulo Inventario 📦"));

ch.push(h2("10.1 Pestaña: Stock actual"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Tabla","Filtros: stock_status, is_saleable, categoría. Columnas: SKU, nombre, qty_on_hand, avg_cost, valor, stock_status, is_saleable"],
  ["Tabs predefinidos","Todos | Solo vendibles (v_saleable_inventory) | Solo internos (v_internal_inventory)"],
  ["Acción: Ver detalle","Drill al producto con histórico"],
  ["Acción: Ajuste manual","Si stock real difiere del sistema, crear inventory_movement tipo ADJUSTMENT (con permiso inventory.adjust)"],
  ["Visualización","Card de KPIs: total SKUs, valor total, % en alerta"]
], [3000, 6360]));

ch.push(h2("10.2 Pestaña: Movimientos"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Lista","Filtros: producto, fecha, movement_type, source_type"],
  ["Detalle","Click en un movimiento → ir al origen (goods_receipt, order_item, NC, asset_component, etc.)"],
  ["Acción: Ajuste manual","Solo con permiso inventory.adjust, requiere notes obligatorias"]
], [3000, 6360]));

ch.push(h2("10.3 Pestaña: KPIs"));
ch.push(p("Consulta v_inventory_kpis con visualizaciones:"));
ch.push(bullet("Distribución por clasificación ABC (donut)"));
ch.push(bullet("Semáforo de movimiento (cuántos productos por color)"));
ch.push(bullet("Productos sin movimiento (lista filtrada)"));
ch.push(bullet("Productos para reorden (stock_status BELOW_MIN)"));
ch.push(bullet("Demanda histórica 90/180 días"));

ch.push(h2("10.4 Pestaña: No conformes"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Lista","Filtros: status (OPEN/RESOLVED/CANCELLED), nc_source (SUPPLIER/CUSTOMER_RETURN/ASSET_REMOVAL/PHYSICAL_COUNT/OTHER)"],
  ["Detalle","Producto, cantidad, motivo, action_taken, vinculación con factura/equipo"],
  ["Acción: Marcar resuelto","status=RESOLVED con action_taken"],
  ["Acción: Registrar nuevo NC","Crear con nc_source apropiado y adjustment_type"]
], [3000, 6360]));

ch.push(h2("10.5 Pestaña: Snapshots"));
ch.push(p("Cierres mensuales de inventario_snapshots. Vista histórica del valor por mes."));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 11. MÓDULO EQUIPOS
ch.push(h1("11. Módulo Equipos / Assets 💻"));

ch.push(h2("11.1 Pestaña: Lista de equipos"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Tabla","Filtros: asset_type, status, location, assigned_user. Columnas: code, name, type, assigned_to, status"],
  ["Botón: Nuevo equipo","Form: code, type, name, marca, modelo, serial, ubicación, asignación"],
  ["Detalle","Tabs: General | Componentes actuales | Historial de cambios | Garantía"]
], [3000, 6360]));

ch.push(h2("11.2 Detalle de equipo"));
ch.push(makeTable([
  ["Tab","Contenido"],
  ["General","Datos del equipo, status, ubicación, asignación, costo, garantía"],
  ["Componentes actuales","Lista de v_asset_current_components: qué partes tiene ahora, con seriales"],
  ["Historial","v_asset_repair_history: timeline de INSTALL / REMOVE / REPLACE"],
  ["Acción: Instalar componente","Form que llama INSERT en asset_components → trigger crea inventory_movement ISSUE"],
  ["Acción: Quitar componente","Llama fn_remove_asset_component(is_reusable). Si reusable: vuelve a stock. Si no: crea NC"],
  ["Acción: Cambiar status","ACTIVE → IN_REPAIR → RETIRED → DISMANTLED"]
], [2400, 6960]));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 12. MÓDULO FACTURACIÓN
ch.push(h1("12. Módulo Facturación CFDI 🧾"));

ch.push(h2("12.1 Pestaña: CFDIs emitidos"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Lista","Filtros: tipo (I/E/P/T), status (DRAFT/TIMBRADO/CANCELLED), serie, fecha, cliente"],
  ["Detalle","Tabs: General | Conceptos | Pagos / Complementos | Relaciones (sustituido_por, sustituye_a)"],
  ["Acción: Ver XML / PDF","Descarga de archivos timbrados"],
  ["Acción: Reenviar al cliente","Email con XML+PDF adjuntos"],
  ["Acción: Cancelar","Wizard: motivo SAT (01-04), CFDI sustituto si motivo=01"]
], [3000, 6360]));

ch.push(h2("12.2 Pestaña: Emitir nuevo"));
ch.push(numList("Paso 1: Tipo de CFDI (I = factura normal)"));
ch.push(numList("Paso 2: Buscar pedido a facturar (orders en status DELIVERED u otros)"));
ch.push(numList("Paso 3: Seleccionar receptor (cliente + RFC + uso CFDI)"));
ch.push(numList("Paso 4: Revisar conceptos (con claves SAT producto/unidad)"));
ch.push(numList("Paso 5: Definir método (PUE/PPD) y forma (01, 03, 06...)"));
ch.push(numList("Paso 6: Pre-visualizar XML"));
ch.push(numList("Paso 7: Botón \"Timbrar\" → llama PAC → registra en cfdi_pac_log"));
ch.push(numList("Si éxito: status=TIMBRADO, descargar XML/PDF, enviar al cliente"));
ch.push(numList("Si error: mostrar mensaje del PAC, permitir corrección y reintento"));

ch.push(h2("12.3 Pestaña: Complementos de pago (PPD)"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Lista de PPDs pendientes","v_cfdi_ppd_pending_payment con saldo restante y días"],
  ["Botón: Emitir complemento","Para un pago recibido, generar CFDI tipo P vinculado al CFDI I original"],
  ["Detalle del CFDI P","Con sus partialities y saldos"]
], [3000, 6360]));

ch.push(h2("12.4 Pestaña: Notas de crédito"));
ch.push(p("Listar NCs (CFDI tipo E) y emitir nuevas vinculadas a un CFDI I."));

ch.push(h2("12.5 Pestaña: Cancelaciones"));
ch.push(p("Vista v_cfdi_cancellations con motivo SAT y CFDI sustituto."));

ch.push(h2("12.6 Pestaña: Bitácora PAC"));
ch.push(p("Vista de cfdi_pac_log: para debugging de errores de timbrado, reintentos, métricas de tasa de éxito."));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 13. MÓDULO COBRANZA / FINANZAS
ch.push(h1("13. Módulo Cobranza / Finanzas 💰"));

ch.push(h2("13.1 Pestaña: Cuentas por cobrar (AR)"));
ch.push(p("Vista v_accounts_receivable con buckets de aging (0-30, 31-60, 61-90, +90). Por cliente, drill al detalle."));

ch.push(h2("13.2 Pestaña: Cuentas por pagar (AP)"));
ch.push(p("Vista v_accounts_payable con vencimientos. Útil para planeación de pagos del mes."));

ch.push(h2("13.3 Pestaña: Pagos recibidos"));
ch.push(makeTable([
  ["Vista / acción","Descripción"],
  ["Lista de payments","Por cliente, fecha, forma de pago, monto, % aplicado"],
  ["Botón: Registrar pago","Form con cliente, monto, forma SAT, referencia bancaria"],
  ["Acción: Aplicar a CFDI / orden","Crear payment_applications, opcionalmente generar CFDI tipo P si era PPD"]
], [3000, 6360]));

ch.push(h2("13.4 Pestaña: Pagos sin aplicar"));
ch.push(p("Vista v_payments_unapplied: dinero recibido que no se ha aplicado a ningún CFDI/orden. Saldo a favor del cliente."));

ch.push(h2("13.5 Pestaña: Flujo de caja proyectado"));
ch.push(p("Vista v_cash_flow_projection: ingresos esperados vs egresos por período, con saldo acumulado."));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 14. MÓDULO REPORTES
ch.push(h1("14. Módulo Reportes 📈"));

ch.push(p("Cada sub-pestaña es un reporte específico. Todos exportables a Excel/CSV/PDF."));

ch.push(h2("14.1 Comercial"));
ch.push(bullet("Ventas por período (mensual/trimestral/anual)"));
ch.push(bullet("Top clientes con margen y aging"));
ch.push(bullet("Conversión de cotizaciones (funnel)"));
ch.push(bullet("Performance por vendedor"));

ch.push(h2("14.2 Margen y rentabilidad"));
ch.push(bullet("Margen por producto (vs target de categoría)"));
ch.push(bullet("Margen por categoría"));
ch.push(bullet("Rentabilidad por cliente"));

ch.push(h2("14.3 Operación"));
ch.push(bullet("KPIs de almacén"));
ch.push(bullet("No conformes por proveedor"));
ch.push(bullet("Eficiencia de rutas"));
ch.push(bullet("Pedidos incompletos"));
ch.push(bullet("Avance de empacado"));

ch.push(h2("14.4 Compras"));
ch.push(bullet("Top proveedores"));
ch.push(bullet("Performance de proveedores (on-time, NCs)"));
ch.push(bullet("Cadena PR→PO→GR→Invoice"));
ch.push(bullet("Aging de facturas (AP)"));

ch.push(h2("14.5 Financiero"));
ch.push(bullet("AR / AP aging"));
ch.push(bullet("Flujo de caja proyectado"));
ch.push(bullet("Gastos por categoría"));
ch.push(bullet("Resumen de facturación por período"));
ch.push(bullet("Histórico de cancelaciones"));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 15. VISTAS POR ROL
ch.push(h1("15. Menú visible por rol"));

ch.push(h2("15.1 ADMIN — ve todo"));
ch.push(code(
`🏠 Inicio (dashboard ejecutivo completo)
📊 Ventas        🚚 Logística     🛒 Compras       📦 Inventario
💻 Equipos       👥 Clientes      🏭 Proveedores   📋 Catálogos
🧾 Facturación   💰 Cobranza      📈 Reportes      ⚙️ Administración
👤 Mi cuenta`));

ch.push(h2("15.2 SALES — vendedor"));
ch.push(code(
`🏠 Inicio (KPIs comerciales: pipeline, top clientes, conversión)
📊 Ventas (cotizaciones, NRs, pedidos, reportes ventas)
👥 Clientes (alta, edición, convenios, estado de cuenta)
📦 Inventario (solo lectura: ver disponibilidad para cotizar)
📈 Reportes (Comercial, Margen)
👤 Mi cuenta`));

ch.push(h2("15.3 PURCHASING — comprador"));
ch.push(code(
`🏠 Inicio (KPIs de compras: PRs pendientes, OCs activas, AP)
🛒 Compras (PRs, POs, recepciones, facturas, gastos)
🏭 Proveedores (alta, edición, catálogo, performance)
📦 Inventario (solo lectura: ver alertas y necesidades)
📋 Catálogos > Productos (lectura)
📈 Reportes (Compras, Operación)
👤 Mi cuenta`));

ch.push(h2("15.4 WAREHOUSE — almacén"));
ch.push(code(
`🏠 Inicio (KPIs almacén: pedidos a empacar, recepciones del día, NCs)
🚚 Logística (empacado, envíos, rutas, fleteras)
📦 Inventario (stock, movimientos, KPIs, no conformes, snapshots)
💻 Equipos (alta, mantenimiento, cambio de piezas)
🛒 Compras > Recepciones (capturar GR)
🛒 Compras > Solicitudes (puede crear PR)
📈 Reportes (Operación, Inventario)
👤 Mi cuenta`));

ch.push(h2("15.5 ACCOUNTING — contabilidad"));
ch.push(code(
`🏠 Inicio (KPIs financieros: AR, AP, flujo, CFDIs del mes)
🧾 Facturación (emitir, cancelar, complementos, NCs, bitácora PAC)
💰 Cobranza (AR, AP, pagos, flujo, gastos)
🛒 Compras > Facturas, Gastos (lectura/pago)
👥 Clientes (lectura, estado de cuenta)
🏭 Proveedores (lectura, estado de cuenta)
📈 Reportes (Financiero, Comercial)
👤 Mi cuenta`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 16. WIREFRAME GENÉRICO
ch.push(h1("16. Wireframe genérico de pantalla"));
ch.push(p("Layout que aplica a todas las pantallas del sistema:"));
ch.push(code(
`┌────────────────────────────────────────────────────────────────────┐
│ [Logo RTB]   ⚙️ Búsqueda global    🔔 Notif.   👤 Diego ▾         │  ← Top bar
├──────────────┬─────────────────────────────────────────────────────┤
│              │  📊 Ventas › Cotizaciones                            │  ← Breadcrumb
│  🏠 Inicio   │  ─────────────────────────────────────────────────   │
│              │                                                      │
│  📊 Ventas   │   [Lista]  [Crear]  [Reportes]                       │  ← Tabs del módulo
│   ├ Cotiz.   │  ─────────────────────────────────────────────────   │
│   ├ NRs      │                                                      │
│   ├ Pedidos  │   ┌─ Filtros ────────────────────────────────────┐   │
│   └ Rep.     │   │ Estado: [Todos ▾]  Cliente: [_______]  ...   │   │
│              │   └──────────────────────────────────────────────┘   │
│  🚚 Logíst.  │                                                      │
│              │   ┌─ Resultados ─────────────── + Nueva cotización─┐│
│  🛒 Compras  │   │ Folio    Cliente    Total     Estado  Acciones││
│              │   │ COT-100  Femsa    $44,660    APROBADA  [...]  ││
│  📦 Inv.     │   │ COT-101  Bimbo     $12,300    ENVIADA   [...]  ││
│              │   │ COT-102  Coca      $8,900     BORRADOR  [...]  ││
│  ...         │   │ ...                                              ││
│              │   └──────────────────────────────────────────────┘   │
│  ⚙️ Admin    │                                                      │
│              │   [< Anterior]   página 1 de 8   [Siguiente >]       │
│  👤 Cuenta   │                                                      │
└──────────────┴─────────────────────────────────────────────────────┘
   sidebar              área de trabajo central`));

ch.push(p("Características transversales:"));
ch.push(bullet("Top bar con búsqueda global (busca por SKU, folio, cliente, RFC)"));
ch.push(bullet("Notificaciones (alertas de stock, pedidos urgentes, CFDIs próximos a vencer)"));
ch.push(bullet("Sidebar colapsable (responsive)"));
ch.push(bullet("Breadcrumb de navegación arriba del contenido"));
ch.push(bullet("Tabs del módulo dentro de la pantalla"));
ch.push(bullet("Filtros desplegables siempre visibles"));
ch.push(bullet("Tablas con ordenamiento, paginación, exportar a Excel"));
ch.push(bullet("Botón de acción primaria (Crear, Emitir, etc.) arriba a la derecha"));
ch.push(bullet("Acciones por fila en menú [...] (editar, eliminar, ver detalle)"));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 17. NOTIFICACIONES
ch.push(h1("17. Sistema de notificaciones"));
ch.push(p("Notificaciones que el sistema debe mostrar (badge en la campanita 🔔):"));

ch.push(h2("17.1 Para SALES"));
ch.push(bullet("Cotización aprobada por el cliente"));
ch.push(bullet("Cotización por vencer en 7 días"));
ch.push(bullet("Cliente con cartera vencida >30 días"));
ch.push(bullet("Pedido entregado completo / parcial"));

ch.push(h2("17.2 Para PURCHASING"));
ch.push(bullet("PR aprobada lista para crear OC"));
ch.push(bullet("Productos que entraron en alerta de stock mínimo"));
ch.push(bullet("OC con fecha estimada de recolección hoy"));
ch.push(bullet("Factura de proveedor próxima a vencer"));

ch.push(h2("17.3 Para WAREHOUSE"));
ch.push(bullet("Nuevo pedido aprobado para empacar"));
ch.push(bullet("Mercancía esperando recepción"));
ch.push(bullet("Ruta asignada para hoy"));
ch.push(bullet("No conforme abierto sin atender > 7 días"));

ch.push(h2("17.4 Para ACCOUNTING"));
ch.push(bullet("Pedido listo para facturar"));
ch.push(bullet("Pago recibido sin aplicar"));
ch.push(bullet("CFDI PPD pendiente de complemento"));
ch.push(bullet("Falla de timbrado en PAC"));
ch.push(bullet("CSD próximo a vencer (< 30 días)"));

ch.push(h2("17.5 Para ADMIN"));
ch.push(bullet("Cambio de configuración fiscal"));
ch.push(bullet("Usuario inactivo > 60 días"));
ch.push(bullet("Cambio en margen de categoría (afecta precios)"));
ch.push(bullet("Eventos de auditoría sospechosos"));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 18. RESUMEN
ch.push(h1("18. Resumen de pantallas"));
ch.push(p("Total estimado de pantallas únicas que la aplicación debe implementar:"));
ch.push(makeTable([
  ["Módulo","Pantallas","Acciones únicas"],
  ["Inicio (dashboard)","1","-"],
  ["Ventas","8 (lista cotiz., detalle cotiz., wizard cotiz., lista NRs, detalle NR, lista pedidos, detalle pedido, reportes)","~25"],
  ["Logística","6 (empacado, lista envíos, detalle envío, rutas calendario, ruta detalle, fleteras)","~20"],
  ["Compras","10 (lista PR, detalle PR, lista PO, detalle PO, lista GR, detalle GR, lista invoices, detalle invoice, gastos)","~30"],
  ["Inventario","6 (stock, movimientos, KPIs, NCs, snapshots, ajustes)","~15"],
  ["Equipos","4 (lista, detalle, instalar/quitar pieza, historial)","~10"],
  ["Clientes","3 (lista, detalle multi-tab, alta/edición)","~15"],
  ["Proveedores","3 (lista, detalle multi-tab, catálogo cross)","~15"],
  ["Catálogos","6 (productos lista, producto detalle, marcas, categorías, etc.)","~20"],
  ["Facturación","8 (CFDIs, emitir, complementos, NCs, cancelaciones, bitácora PAC, etc.)","~20"],
  ["Cobranza/Finanzas","5 (AR, AP, pagos, sin aplicar, flujo)","~15"],
  ["Reportes","5 secciones × ~3 reportes c/u","~15"],
  ["Administración","6 (usuarios, roles, fiscal, series, SAT, auditoría)","~25"],
  ["Mi cuenta","2-3","~5"],
  ["TOTAL","~70 pantallas únicas","~230 acciones"]
], [2200, 4660, 2500]));

ch.push(p("Recomendación: comenzar el desarrollo por el flujo más crítico (Cotización → Orden → CFDI) y agregar módulos progresivamente."));

const doc = new Document({
  creator: "Sistema RTB", title: "Estructura de Navegación",
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
      children: [new TextRun({ text: "RTB · Estructura de Navegación", font: ARIAL, size: 18, color: GRAY })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Página ", font: ARIAL, size: 18, color: GRAY }),
                 new TextRun({ children: [PageNumber.CURRENT], font: ARIAL, size: 18, color: GRAY })] })] }) },
    children: ch
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/sessions/bold-dazzling-brahmagupta/mnt/outputs/rtb/16_estructura_navegacion.docx", buf);
  console.log("DOCX listo:", buf.length, "bytes");
});

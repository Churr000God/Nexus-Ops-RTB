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
  children: [new TextRun({ text: "Reportes y", font: ARIAL, size: 56, bold: true })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
  children: [new TextRun({ text: "Dashboards", font: ARIAL, size: 56, bold: true })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360, after: 120 },
  children: [new TextRun({ text: "Sistema RTB · PostgreSQL", font: ARIAL, size: 28, color: GRAY })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "Comercial · Margen · Compras · Financiero · Operación · Ejecutivo", font: ARIAL, size: 18, color: GRAY })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 },
  children: [new TextRun({ text: "Documento de diseño y operación · v1.0", font: ARIAL, size: 22, color: GRAY })] }));
ch.push(new Paragraph({ children: [new PageBreak()] }));

// 1. INTRO
ch.push(h1("1. Introducción"));
ch.push(p("Este documento describe la capa de reportes y dashboards del sistema RTB. Toda la analítica se construye sobre vistas SQL especializadas que actúan como una API estable: la app, herramientas de BI (Metabase, Superset, Tableau), o dashboards HTML pueden consumirlas directamente sin tocar las tablas operativas."));

ch.push(h2("1.1 Filosofía"));
ch.push(bullet("Las tablas operativas NO se consultan directamente para reportes."));
ch.push(bullet("Cada reporte es una vista (o consulta sobre vistas) — la lógica está versionada con el schema."));
ch.push(bullet("Las vistas son semánticamente significativas: 'top_customers' en lugar de un SELECT con JOINs."));
ch.push(bullet("Si un reporte se vuelve costoso, se materializa con MATERIALIZED VIEW + REFRESH nocturno."));
ch.push(bullet("Permisos: el rol con permiso report.* puede leer las vistas; las tablas operativas siguen restringidas."));

ch.push(h2("1.2 Vistas por área"));
ch.push(makeTable([
  ["Área","Vistas","Para quién"],
  ["Comercial","v_sales_by_period, v_top_customers, v_quote_conversion, v_sales_rep_performance","Director comercial, gerente ventas"],
  ["Margen","v_product_margin, v_customer_profitability, v_category_margin","Finanzas, comercial"],
  ["Compras","v_top_suppliers, v_supplier_performance, v_purchase_chain","Compras, dirección"],
  ["Financiero","v_accounts_receivable, v_accounts_payable, v_cash_flow_projection, v_expenses_by_category","Contabilidad, dirección"],
  ["Operación","v_warehouse_kpis, v_nc_by_supplier, v_route_efficiency","Almacén, operaciones"],
  ["Inventario","v_inventory_current, v_inventory_kpis","Compras, almacén"],
  ["CFDI","v_cfdi_emitted, v_cfdi_ppd_pending_payment, v_cfdi_summary_by_period","Contabilidad"],
  ["Ejecutivo","v_executive_dashboard","Dirección general"]
], [1700, 4500, 3160]));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 2. COMERCIAL
ch.push(h1("2. Reportes comerciales"));

ch.push(h2("2.1 v_sales_by_period"));
ch.push(p("Resumen de ventas por mes / trimestre / año, con margen calculado."));
ch.push(code(
`SELECT * FROM v_sales_by_period WHERE year = 2026 ORDER BY month;
-- Devuelve: year, quarter, month, num_orders, subtotal, total, cost,
--           gross_margin, margin_pct`));

ch.push(h2("2.2 v_top_customers"));
ch.push(p("Ranking de clientes por revenue, con margen y días desde última orden."));
ch.push(code(
`SELECT business_name, num_orders, total_revenue, gross_margin, margin_pct, days_since_last_order
FROM v_top_customers
LIMIT 20;`));
ch.push(p("days_since_last_order alto puede indicar cliente \"dormido\" — útil para campañas de retención."));

ch.push(h2("2.3 v_quote_conversion"));
ch.push(p("Tasa de conversión de cotizaciones por mes: cuántas se aprobaron de las que se enviaron."));
ch.push(code(
`SELECT * FROM v_quote_conversion WHERE year = 2026 ORDER BY month;
-- Métricas: total_quotes, approved, rejected, conversion_pct, total_quoted, total_won`));

ch.push(h2("2.4 v_sales_rep_performance"));
ch.push(p("Performance por vendedor: cotizaciones, conversión, revenue, margen, ticket promedio."));
ch.push(code(
`SELECT sales_rep, quotes_created, quotes_approved, conversion_pct,
       revenue_generated, margin_generated, avg_order_value
FROM v_sales_rep_performance
ORDER BY revenue_generated DESC;`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 3. MARGEN
ch.push(h1("3. Reportes de margen y rentabilidad"));

ch.push(h2("3.1 v_product_margin"));
ch.push(p("Por cada producto: cuánto se vendió, cuánto costó, margen real vs target de la categoría."));
ch.push(code(
`SELECT sku, name, category, category_target_margin AS target,
       units_sold, revenue, cost, gross_margin, actual_margin_pct AS real
FROM v_product_margin
WHERE units_sold > 0
ORDER BY actual_margin_pct;
-- Productos con margen actual < target son señal de revisar precio o costo`));

ch.push(h2("3.2 v_customer_profitability"));
ch.push(p("Rentabilidad por cliente: cuánto se vendió, cuánto se cobró, días promedio de pago."));
ch.push(code(
`SELECT business_name, revenue, cost, gross_margin, margin_pct,
       amount_outstanding, avg_days_to_pay
FROM v_customer_profitability
ORDER BY gross_margin DESC LIMIT 30;`));

ch.push(h2("3.3 v_category_margin"));
ch.push(p("Margen por categoría comparado contra el target establecido."));
ch.push(code(
`SELECT category, target_margin, actual_margin_pct, revenue, items_sold
FROM v_category_margin
ORDER BY revenue DESC;
-- Si actual_margin_pct < target_margin, hay que ajustar precios o costos`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 4. COMPRAS
ch.push(h1("4. Reportes de compras"));

ch.push(h2("4.1 v_top_suppliers"));
ch.push(code(
`SELECT business_name, num_pos, total_purchased, avg_po_value,
       avg_payment_time_days, days_since_last_po
FROM v_top_suppliers
LIMIT 20;`));

ch.push(h2("4.2 v_supplier_performance"));
ch.push(p("Cumplimiento de tiempos: lead time real vs estimado, % de OCs entregadas a tiempo, NCs registradas."));
ch.push(code(
`SELECT business_name, pos_completed, avg_actual_lead_days, avg_estimated_lead_days,
       avg_delay_days, on_time_pct, total_ncs
FROM v_supplier_performance
ORDER BY on_time_pct ASC;
-- Proveedores con on_time_pct bajo o muchos NCs son candidatos a revisar`));

ch.push(h2("4.3 v_supplier_invoices_aging"));
ch.push(p("Aging de cuentas por pagar (ya creada en módulo de compras)."));
ch.push(code(
`SELECT supplier, invoice_number, total, payment_due_date, days_overdue, aging_bucket
FROM v_supplier_invoices_aging
WHERE payment_status <> 'PAID'
ORDER BY days_overdue DESC;`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 5. FINANCIERO
ch.push(h1("5. Reportes financieros"));

ch.push(h2("5.1 v_accounts_receivable (AR aging)"));
ch.push(p("Cuentas por cobrar segmentadas por antigüedad. Lectura rápida del riesgo de cartera."));
ch.push(code(
`SELECT business_name, billed, collected, outstanding,
       bucket_0_30, bucket_31_60, bucket_61_90, bucket_90_plus
FROM v_accounts_receivable
WHERE outstanding > 0
ORDER BY bucket_90_plus DESC, outstanding DESC;
-- Clientes con bucket_90_plus son riesgo alto de cobranza`));

ch.push(h2("5.2 v_accounts_payable (AP aging)"));
ch.push(code(
`SELECT business_name, outstanding, bucket_current,
       bucket_overdue_30, bucket_overdue_60, bucket_overdue_60_plus
FROM v_accounts_payable
ORDER BY outstanding DESC;`));

ch.push(h2("5.3 v_cash_flow_projection"));
ch.push(p("Proyección de flujo de caja por período (próximos 90 días)."));
ch.push(code(
`SELECT period, period_date, inflow, outflow, net,
       SUM(net) OVER (ORDER BY period_date) AS running_balance
FROM v_cash_flow_projection
ORDER BY period_date;
-- Permite ver: ¿en qué semana o mes el flujo neto se vuelve negativo?`));

ch.push(h2("5.4 v_expenses_by_category"));
ch.push(code(
`SELECT year, month, category, total, deductible, non_deductible
FROM v_expenses_by_category
WHERE year = 2026
ORDER BY year DESC, month DESC, total DESC;`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 6. OPERACIÓN
ch.push(h1("6. Reportes de operación"));

ch.push(h2("6.1 v_warehouse_kpis"));
ch.push(p("Una sola fila con todos los indicadores clave de almacén."));
ch.push(code(
`SELECT * FROM v_warehouse_kpis;
-- Devuelve:
-- active_skus_saleable, skus_out_of_stock, skus_below_min, total_inventory_value,
-- receipts_this_month, issues_this_month,
-- active_orders, orders_with_shortage, orders_in_packing,
-- open_non_conformities`));

ch.push(h2("6.2 v_nc_by_supplier"));
ch.push(p("Calidad por proveedor: cuántos NCs se han recibido en el último trimestre."));
ch.push(code(
`SELECT business_name, total_ncs, ncs_last_90d, open_ncs, total_quantity_affected
FROM v_nc_by_supplier
ORDER BY ncs_last_90d DESC;`));

ch.push(h2("6.3 v_route_efficiency"));
ch.push(code(
`SELECT route_number, route_date, driver, total_stops, completed_stops,
       deliveries, pickups, duration_hours, completion_pct
FROM v_route_efficiency
ORDER BY route_date DESC;`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 7. INVENTARIO Y KPIS
ch.push(h1("7. Inventario y KPIs (vistas existentes recap)"));

ch.push(h2("7.1 ABC, semáforo, días sin movimiento"));
ch.push(code(
`SELECT sku, name, quantity_on_hand, abc_classification,
       movement_traffic_light, days_without_movement,
       suggested_action
FROM v_inventory_kpis
WHERE abc_classification = 'A' AND movement_traffic_light = 'RED';
-- Productos clase A sin movimiento — situación crítica`));

ch.push(h2("7.2 Productos para reorden"));
ch.push(code(
`SELECT sku, name, quantity_on_hand, min_stock, demand_90d, suggested_action
FROM v_inventory_kpis
WHERE suggested_action IN ('PURCHASE_URGENT','PURCHASE')
ORDER BY demand_90d DESC;`));

ch.push(h2("7.3 Demanda histórica"));
ch.push(code(
`SELECT sku, name, demand_90d, demand_180d,
       demand_180d - demand_90d AS demand_91_180,
       (demand_90d * 4)::INT AS estimated_annual_demand
FROM v_inventory_kpis
WHERE demand_90d > 0
ORDER BY demand_90d DESC;`));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 8. EJECUTIVO
ch.push(h1("8. Dashboard ejecutivo"));
ch.push(p("Una sola consulta que devuelve todos los KPIs clave para la dirección."));

ch.push(h2("8.1 v_executive_dashboard"));
ch.push(code(
`SELECT * FROM v_executive_dashboard;`));

ch.push(h2("8.2 Métricas que devuelve"));
ch.push(makeTable([
  ["Métrica","Significado"],
  ["revenue_mtd","Ventas del mes a la fecha"],
  ["margin_mtd","Margen bruto del mes"],
  ["open_quotes / open_quotes_value","Pipeline de cotizaciones abiertas"],
  ["total_ar","Total cuentas por cobrar"],
  ["ar_overdue_60_plus","Cartera vencida > 60 días (riesgo alto)"],
  ["total_ap","Total cuentas por pagar"],
  ["inventory_value","Valor total del inventario"],
  ["skus_in_alert","Productos sin stock o bajo mínimo"],
  ["active_orders","Pedidos en proceso"],
  ["orders_with_shortage","Pedidos con faltante"],
  ["open_ncs","No conformes abiertos"],
  ["cfdis_emitted_mtd","CFDIs timbrados en el mes"],
  ["cfdis_cancelled_mtd","CFDIs cancelados en el mes"]
], [3500, 5860]));

ch.push(p("Esta vista alimenta el dashboard HTML de la página principal del sistema."));

ch.push(new Paragraph({ children: [new PageBreak()] }));

// 9. CONSUMO DESDE BI
ch.push(h1("9. Consumo desde herramientas de BI"));

ch.push(h2("9.1 Metabase / Superset"));
ch.push(p("Conexión directa a PostgreSQL con un usuario read-only que solo tenga GRANT SELECT en las vistas v_*. Esto separa la consulta analítica de la operación, evitando bloqueos en producción."));
ch.push(code(
`-- Crear usuario para BI con permisos solo en vistas
CREATE ROLE bi_readonly LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA rtb TO bi_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA rtb TO bi_readonly;  -- vistas y tablas
-- Mejor: solo vistas
REVOKE SELECT ON ALL TABLES IN SCHEMA rtb FROM bi_readonly;
GRANT SELECT ON v_sales_by_period, v_top_customers, v_quote_conversion,
                v_inventory_kpis, v_accounts_receivable, ... TO bi_readonly;`));

ch.push(h2("9.2 Excel vía ODBC"));
ch.push(p("Para usuarios que prefieren Excel, se puede instalar ODBC driver de PostgreSQL y conectar directo. Cada vista aparece como una tabla."));

ch.push(h2("9.3 API REST"));
ch.push(p("La app puede exponer endpoints como /api/reports/sales-by-period que ejecutan SELECT en las vistas y devuelven JSON. Esto desacopla el frontend del schema."));

ch.push(h2("9.4 Materialización"));
ch.push(p("Si una vista se vuelve lenta (ej. v_inventory_kpis con muchos productos):"));
ch.push(code(
`CREATE MATERIALIZED VIEW mv_inventory_kpis AS
    SELECT * FROM v_inventory_kpis;
CREATE INDEX ON mv_inventory_kpis (product_id);

-- Refrescar cada noche (con CONCURRENTLY para no bloquear queries)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_kpis;`));

ch.push(p("Lo recomendado: arrancar con vistas regulares y materializar solo cuando hay evidencia de lentitud (>2s)."));

const doc = new Document({
  creator: "Sistema RTB", title: "Reportes y Dashboards",
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
      children: [new TextRun({ text: "RTB · Reportes y Dashboards", font: ARIAL, size: 18, color: GRAY })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Página ", font: ARIAL, size: 18, color: GRAY }),
                 new TextRun({ children: [PageNumber.CURRENT], font: ARIAL, size: 18, color: GRAY })] })] }) },
    children: ch
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/sessions/bold-dazzling-brahmagupta/mnt/outputs/rtb/15_modulo_reportes.docx", buf);
  console.log("DOCX listo:", buf.length, "bytes");
});

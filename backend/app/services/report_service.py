from __future__ import annotations

import io
from datetime import date, datetime, timezone

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from lxml import etree
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ventas_service import VentasService

_BRAND_BLUE = RGBColor(0x1E, 0x40, 0xAF)
_GRAY = RGBColor(0x6B, 0x72, 0x80)
_SECTION_KEYS = {"kpis", "clientes", "productos", "margen", "pagos", "riesgo"}


def _fmt_mxn(value: float | None) -> str:
    if value is None:
        return "—"
    return f"${value:,.2f} MXN"


def _fmt_num(value: float | int | None, decimals: int = 2) -> str:
    if value is None:
        return "—"
    return f"{value:,.{decimals}f}"


def _fmt_pct(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value:.1f}%"


def _set_col_width(cell, width_inches: float) -> None:
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcW = tcPr.get_or_add_tcW()
    tcW.set(qn("w:w"), str(int(width_inches * 1440)))
    tcW.set(qn("w:type"), "dxa")


def _add_heading(doc: Document, text: str, level: int = 1) -> None:
    p = doc.add_heading(text, level=level)
    run = p.runs[0] if p.runs else p.add_run(text)
    run.font.color.rgb = _BRAND_BLUE
    if level == 1:
        run.font.size = Pt(16)
    else:
        run.font.size = Pt(13)


def _add_table_header_row(table, headers: list[str]) -> None:
    hdr = table.rows[0]
    for i, h in enumerate(headers):
        cell = hdr.cells[i]
        cell.text = h
        run = cell.paragraphs[0].runs[0]
        run.bold = True
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        cell._tc.get_or_add_tcPr()
        shd = cell._element.get_or_add_tcPr()


def _style_header_cell(cell) -> None:
    """Pinta la celda de encabezado con fondo azul oscuro usando lxml directo."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    for existing in tcPr.findall(qn("w:shd")):
        tcPr.remove(existing)
    shd = etree.SubElement(tcPr, qn("w:shd"))
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), "1E40AF")
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if p.runs:
        p.runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        p.runs[0].bold = True


def _add_table(
    doc: Document, headers: list[str], rows: list[list[str]]
) -> None:
    col_count = len(headers)
    table = doc.add_table(rows=1 + len(rows), cols=col_count)
    table.style = "Table Grid"

    for i, h in enumerate(headers):
        cell = table.cell(0, i)
        cell.text = h
        _style_header_cell(cell)

    for r_idx, row in enumerate(rows):
        for c_idx, val in enumerate(row):
            cell = table.cell(r_idx + 1, c_idx)
            cell.text = val
            p = cell.paragraphs[0]
            if c_idx > 0:
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT

    doc.add_paragraph()


class ReportService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def generate_ventas_docx(
        self,
        start_date: date | None,
        end_date: date | None,
        sections: list[str],
    ) -> bytes:
        svc = VentasService(self._db)
        selected = {s.lower().strip() for s in sections} & _SECTION_KEYS

        summary = await svc.sales_summary(start_date=start_date, end_date=end_date) if "kpis" in selected else None
        top_customers = await svc.top_customers_by_sales(start_date=start_date, end_date=end_date, limit=15) if "clientes" in selected else []
        gross_margin = await svc.gross_margin_by_product(start_date=start_date, end_date=end_date, limit=15) if "margen" in selected else []
        product_dist = await svc.sales_distribution_by_product(start_date=start_date, end_date=end_date, limit=15) if "productos" in selected else []
        pending_payments = await svc.pending_payment_customers() if "pagos" in selected else []
        at_risk = await svc.at_risk_customers() if "riesgo" in selected else []

        doc = Document()

        _set_page_margins(doc)

        _build_cover(doc, start_date, end_date)

        if summary and "kpis" in selected:
            _build_kpis_section(doc, summary)

        if top_customers and "clientes" in selected:
            _build_top_customers_section(doc, top_customers)

        if product_dist and "productos" in selected:
            _build_product_distribution_section(doc, product_dist)

        if gross_margin and "margen" in selected:
            _build_gross_margin_section(doc, gross_margin)

        if pending_payments and "pagos" in selected:
            _build_pending_payments_section(doc, pending_payments)

        if at_risk and "riesgo" in selected:
            _build_at_risk_section(doc, at_risk)

        buf = io.BytesIO()
        doc.save(buf)
        return buf.getvalue()

    async def generate_ventas_csv(
        self,
        start_date: date | None,
        end_date: date | None,
        sections: list[str],
    ) -> bytes:
        """Genera un CSV multi-sección con los mismos datos que el DOCX."""
        svc = VentasService(self._db)
        selected = {s.lower().strip() for s in sections} & _SECTION_KEYS

        lines: list[str] = []

        if "kpis" in selected:
            summary = await svc.sales_summary(start_date=start_date, end_date=end_date)
            lines += [
                "# RESUMEN KPIs",
                "indicador,valor",
                f"Ventas Totales,{summary.total_sales}",
                f"Cotizaciones Aprobadas,{summary.approved_quotes}",
                f"Cotizaciones Pendientes,{summary.pending_quotes}",
                f"Cotizaciones Canceladas,{summary.cancelled_quotes}",
                f"Tasa de Conversión %,{summary.conversion_rate}",
                f"Margen Promedio %,{summary.average_margin_percent}",
                "",
            ]

        if "clientes" in selected:
            customers = await svc.top_customers_by_sales(start_date=start_date, end_date=end_date, limit=50)
            lines += [
                "# TOP CLIENTES POR VENTAS",
                "cliente,categoria,num_ventas,total_mxn,ticket_promedio_mxn",
            ]
            for c in customers:
                lines.append(
                    f"{_csv_esc(c.customer)},{_csv_esc(c.category or '')},"
                    f"{c.sale_count},{c.total_revenue},{c.average_ticket}"
                )
            lines.append("")

        if "productos" in selected:
            products = await svc.sales_distribution_by_product(start_date=start_date, end_date=end_date, limit=50)
            lines += [
                "# DISTRIBUCIÓN POR PRODUCTO",
                "producto,sku,unidades,revenue_mxn,porcentaje",
            ]
            for p in products:
                lines.append(
                    f"{_csv_esc(p.product)},{_csv_esc(p.sku or '')},"
                    f"{p.qty},{p.revenue},{p.percentage}"
                )
            lines.append("")

        if "margen" in selected:
            margins = await svc.gross_margin_by_product(start_date=start_date, end_date=end_date, limit=50)
            lines += [
                "# MARGEN BRUTO POR PRODUCTO",
                "producto,sku,ingresos_mxn,costo_mxn,margen_mxn,margen_pct",
            ]
            for m in margins:
                lines.append(
                    f"{_csv_esc(m.product)},{_csv_esc(m.sku or '')},"
                    f"{m.revenue},{m.cost},{m.gross_margin},{m.margin_percent or 0}"
                )
            lines.append("")

        if "pagos" in selected:
            payments = await svc.pending_payment_customers()
            lines += [
                "# PAGOS PENDIENTES",
                "cliente,tipo_cliente,pedidos,total_adeudado_mxn,dias_sin_pagar",
            ]
            for p in payments:
                lines.append(
                    f"{_csv_esc(p.customer_name)},{_csv_esc(p.tipo_cliente or '')},"
                    f"{p.num_pedidos},{p.total_adeudado},{p.dias_sin_pagar or ''}"
                )
            lines.append("")

        if "riesgo" in selected:
            at_risk = await svc.at_risk_customers()
            lines += [
                "# CLIENTES EN RIESGO DE ABANDONO",
                "cliente,riesgo,compras_ult_90_mxn,compras_90_previos_mxn,ultima_compra",
            ]
            for c in at_risk:
                ultima = c.ultima_compra.isoformat() if c.ultima_compra else ""
                lines.append(
                    f"{_csv_esc(c.customer_name)},{_csv_esc(c.riesgo_abandono)},"
                    f"{c.compras_ult_90},{c.compras_90_previos},{ultima}"
                )
            lines.append("")

        return "\n".join(lines).encode("utf-8-sig")


def _csv_esc(value: str) -> str:
    if "," in value or '"' in value or "\n" in value:
        return '"' + value.replace('"', '""') + '"'
    return value


def _set_page_margins(doc: Document) -> None:
    from docx.oxml.ns import qn as _qn

    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1.2)
        section.right_margin = Inches(1.2)


def _build_cover(doc: Document, start_date: date | None, end_date: date | None) -> None:
    doc.add_paragraph()
    title = doc.add_heading("Reporte de Ventas", level=0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if title.runs:
        title.runs[0].font.color.rgb = _BRAND_BLUE
        title.runs[0].font.size = Pt(22)

    subtitle = doc.add_paragraph("Nexus Ops RTB — Dashboard Operativo")
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if subtitle.runs:
        subtitle.runs[0].font.color.rgb = _GRAY
        subtitle.runs[0].font.size = Pt(11)

    period_label = _period_label(start_date, end_date)
    period = doc.add_paragraph(period_label)
    period.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if period.runs:
        period.runs[0].font.size = Pt(10)
        period.runs[0].font.color.rgb = _GRAY

    gen_time = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
    gen = doc.add_paragraph(f"Generado: {gen_time}")
    gen.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if gen.runs:
        gen.runs[0].font.size = Pt(9)
        gen.runs[0].font.color.rgb = _GRAY

    doc.add_page_break()


def _period_label(start_date: date | None, end_date: date | None) -> str:
    if start_date and end_date:
        return f"Periodo: {start_date.strftime('%d/%m/%Y')} — {end_date.strftime('%d/%m/%Y')}"
    if start_date:
        return f"Desde: {start_date.strftime('%d/%m/%Y')}"
    if end_date:
        return f"Hasta: {end_date.strftime('%d/%m/%Y')}"
    return "Periodo: Todos los datos históricos"


def _build_kpis_section(doc: Document, summary) -> None:
    _add_heading(doc, "1. Resumen de KPIs", level=1)

    rows = [
        ["Ventas Totales", _fmt_mxn(summary.total_sales)],
        ["Cotizaciones Aprobadas", _fmt_num(summary.approved_quotes, 0)],
        ["Cotizaciones Pendientes", _fmt_num(summary.pending_quotes, 0)],
        ["Cotizaciones Canceladas", _fmt_num(summary.cancelled_quotes, 0)],
        ["Tasa de Conversión", _fmt_pct(summary.conversion_rate)],
        ["Margen Promedio", _fmt_pct(summary.average_margin_percent)],
    ]
    _add_table(doc, ["Indicador", "Valor"], rows)


def _build_top_customers_section(doc: Document, customers: list) -> None:
    _add_heading(doc, "2. Top Clientes por Ventas", level=1)
    doc.add_paragraph(
        "Los siguientes clientes representan el mayor volumen de ventas en el periodo seleccionado."
    )

    rows = [
        [
            str(i + 1),
            c.customer,
            c.category or "—",
            _fmt_num(c.sale_count, 0),
            _fmt_mxn(c.total_revenue),
            _fmt_mxn(c.average_ticket),
        ]
        for i, c in enumerate(customers)
    ]
    _add_table(
        doc,
        ["#", "Cliente", "Categoría", "Ventas", "Total MXN", "Ticket Prom."],
        rows,
    )


def _build_product_distribution_section(doc: Document, products: list) -> None:
    _add_heading(doc, "3. Distribución de Ventas por Producto", level=1)

    rows = [
        [
            p.product,
            p.sku or "—",
            _fmt_num(p.qty, 0),
            _fmt_mxn(p.revenue),
            _fmt_pct(p.percentage),
        ]
        for p in products
    ]
    _add_table(
        doc,
        ["Producto", "SKU", "Unidades", "Revenue MXN", "% del Total"],
        rows,
    )


def _build_gross_margin_section(doc: Document, products: list) -> None:
    _add_heading(doc, "4. Margen Bruto por Producto", level=1)
    doc.add_paragraph(
        "Comparación entre ingresos y costo de compra para los productos más relevantes."
    )

    rows = [
        [
            p.product,
            p.sku or "—",
            _fmt_mxn(p.revenue),
            _fmt_mxn(p.cost),
            _fmt_mxn(p.gross_margin),
            _fmt_pct(p.margin_percent),
        ]
        for p in products
    ]
    _add_table(
        doc,
        ["Producto", "SKU", "Ingresos", "Costo", "Margen MXN", "% Margen"],
        rows,
    )


def _build_pending_payments_section(doc: Document, payments: list) -> None:
    _add_heading(doc, "5. Pagos Pendientes por Cliente", level=1)
    doc.add_paragraph(
        "Clientes con cotizaciones aprobadas aún sin registrar pago completo."
    )

    rows = [
        [
            p.customer_name,
            p.tipo_cliente or "—",
            _fmt_num(p.num_pedidos, 0),
            _fmt_mxn(p.total_adeudado),
            str(p.dias_sin_pagar) + " días" if p.dias_sin_pagar is not None else "—",
        ]
        for p in payments
    ]
    _add_table(
        doc,
        ["Cliente", "Tipo", "Pedidos", "Total Adeudado MXN", "Sin pagar"],
        rows,
    )


def _build_at_risk_section(doc: Document, customers: list) -> None:
    _add_heading(doc, "6. Clientes en Riesgo de Abandono", level=1)
    doc.add_paragraph(
        "Clientes con caída significativa en compras comparando los últimos 90 días "
        "contra los 90 días previos."
    )

    rows = [
        [
            c.customer_name,
            c.riesgo_abandono or "—",
            _fmt_mxn(c.compras_ult_90),
            _fmt_mxn(c.compras_90_previos),
            c.ultima_compra.strftime("%d/%m/%Y") if c.ultima_compra else "—",
        ]
        for c in customers
    ]
    _add_table(
        doc,
        ["Cliente", "Riesgo", "Últimos 90 días", "90 días previos", "Última compra"],
        rows,
    )

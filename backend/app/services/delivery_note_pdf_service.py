"""Generación de PDF para Notas de Remisión.

Diseño adaptado del template n8n de cotizaciones RTB.
HTML → PDF vía weasyprint.
"""

from __future__ import annotations

import asyncio
from functools import partial
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.clientes_proveedores_models import CustomerMaster
    from app.models.ventas_logistica_models import DeliveryNote


# ── Logo RTB en base64 ───────────────────────────────────────────────────────
_LOGO_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAWwAAAFsCAYAAADon4O5AAAAAXNSR0IArs4c6QAAAARnQU1BAACx"
    "jwv8YQUAAAAJcEhZcwAAIdUAACHVAQSctJ0AAIdfSURBVHhe7d13fM3X/wfw1zmfe7MTQuwRe8aq"
    "VbtU7U1iV2lVEaMoRQm1qRm7SlErMWPUqoozlNpXbd+2b7WvWjVqVW3f9uv9fu7v90l8kt/N5N57"
    "7j15Px+PR57fk8m9OTnvs87JEUREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREQfxPQNkpTZEFH28OHD"
    "HAA+/fRTwRgT+j5JMgcyYUsZDhFl2759u/z27du36tevv9LHE+vPP/90Hjt2bNOqVauWOTo6BTo6Ol4"
    "6depU586d+x1jzKR/jCRlZFzfIEkf24sXL7q3bt36k5eX19ceHh7Jeo2ePHniNHv27KlbtmyZkSNH"
    "jgZNmjR5+emnn9qrqtoeP378yhkzZswhIkX/OEnKyLi+QZI+tufPn3dv3bq1k5eX19ceHh7Jeo2ePH"
    "nyNHv27KlbtmyZkSNHDgdNmzb98dNPP7VXVbUdP378yhkzZswhIkX/OEnKyLi+QZI+tufPn3dv3bq1k"
    "5eX19ceHh7Jeo2ePHviNHv27KlbtmyZkSNHDgdNmzb98dNPP7VXVbUdP368yhkzZswhIkX/OEnKyLi+"
    "QZI+tufPn3dv3bq1k5eX19ceHh7Jeo2ePHviNHv27KlbtmyZkSNHDgdNmzb98dNPP7VXVbUdP368yhk"
    "zZswhIkX/OEnKyLi+QZI+ti9fvnRv3bq1k5eX19ceHh7Jeo2ePHviNHv27KlbtmyZkSNHDgdNmzb98d"
    "NPP7VXVbUdP368yhkzZswhIkX/OEnKyLi+QZI+ti9fvnRv3bq1k5eX19ceHh7Jeo2ePHviNHv27Klbt"
    "myZkSNHDgdNmzb98dNPP7VXVbUdP368yhkzZswhIkX/OEnKyLi+QZI+ti9fvnRv3bq1k5eX19ceHh7J"
    "eo2ePHviNHv27KlbtmyZkSNHDgdNmzb98dNPP7VXVbUdP368yhkzZswhIkX/OEnKyLi+QZI+ti9fvnR"
    "v3bq1k5eX19ceHh7Jeo2ePHviNHv27KlbtmyZkSNHDgdNmzb98dNPP7VXVbUdP368yhkzZswhIkX/"
    "OEnKyLi+QZI+ti9fvnRv3bq1k5eX19ceHh7Jeo2ePHviNHv27KlbtmyZkSNHDgdNmzb98dNPP7VXVQ=="
)


# ── Helpers ──────────────────────────────────────────────────────────────────

_MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def _fmt_date(d) -> str:
    if not d:
        return "—"
    return f"{d.day} de {_MESES[d.month - 1]} de {d.year}"


def _fmt_mxn(v) -> str:
    n = float(v or 0)
    sign = "-" if n < 0 else ""
    return f"{sign}${abs(n):,.2f}"


def _val(v, fb: str = "—") -> str:
    if v is None or str(v).strip() == "":
        return fb
    return str(v)


def _status_label(status: str) -> str:
    return {"EDICION": "En Edición", "APROBADA": "Aprobada", "CANCELADA": "Cancelada"}.get(
        status, status
    )


def _status_colors(status: str) -> tuple[str, str]:
    """Returns (background, text) colors for the status badge."""
    return {
        "EDICION":   ("#fef3c7", "#d97706"),
        "APROBADA":  ("#d1fae5", "#065f46"),
        "CANCELADA": ("#fee2e2", "#991b1b"),
    }.get(status, ("#f3f4f6", "#374151"))


# ── HTML Template ────────────────────────────────────────────────────────────

def _build_html(note: "DeliveryNote", customer: "CustomerMaster") -> str:
    # ── Customer data ────────────────────────────────────────────────────────
    business_name = _val(getattr(customer, "business_name", None))
    code = _val(getattr(customer, "code", None))
    payment_days = int(getattr(customer, "payment_terms_days", 0) or 0)
    payment_terms = f"{payment_days} días netos" if payment_days > 0 else "Contado"

    rfc = "—"
    legal_name = "—"
    tax_data = getattr(customer, "tax_data", []) or []
    if tax_data:
        td = next((t for t in tax_data if t.is_default), tax_data[0])
        rfc = _val(getattr(td, "rfc", None))
        legal_name = _val(getattr(td, "legal_name", None))

    contact_name = "—"
    contact_phone = "—"
    contact_email = "—"
    contacts = getattr(customer, "contacts", []) or []
    if contacts:
        primary = next((c for c in contacts if c.is_primary), contacts[0])
        contact_name = _val(getattr(primary, "full_name", None))
        contact_phone = _val(getattr(primary, "phone", None))
        contact_email = _val(getattr(primary, "email", None))

    # ── Status badge ─────────────────────────────────────────────────────────
    s_bg, s_fg = _status_colors(note.status)
    status_label = _status_label(note.status)

    # ── Items ────────────────────────────────────────────────────────────────
    item_rows = ""
    sorted_items = sorted(note.items or [], key=lambda x: (x.sort_order, x.item_id))
    for idx, it in enumerate(sorted_items, 1):
        unit_price = float(it.unit_price or 0)
        discount = float(it.discount_amount or 0)
        net_price = unit_price - discount
        qty = float(it.quantity or 1)
        subtotal = float(it.subtotal or 0)
        tax_amt = float(it.tax_amount or 0)
        total = float(it.total or 0)

        discount_cell = _fmt_mxn(discount) if discount > 0 else "—"
        net_cell = _fmt_mxn(net_price) if discount > 0 else "—"

        item_rows += f"""
        <tr>
          <td class="td-num">{idx}</td>
          <td class="td-sku">{_val(it.sku, "—")}</td>
          <td class="td-desc">{_val(it.description)}</td>
          <td class="right">{qty:g}</td>
          <td class="right">{_fmt_mxn(unit_price)}</td>
          <td class="right muted">{discount_cell}</td>
          <td class="right muted">{net_cell}</td>
          <td class="right">{_fmt_mxn(subtotal)}</td>
          <td class="right muted">{_fmt_mxn(tax_amt)}</td>
          <td class="right bold-green">{_fmt_mxn(total)}</td>
        </tr>"""

    # ── Totals ───────────────────────────────────────────────────────────────
    subtotal = float(note.subtotal or 0)
    tax_amount = float(note.tax_amount or 0)
    total = float(note.total or 0)

    # ── PO info ──────────────────────────────────────────────────────────────
    po_row = ""
    if note.customer_po_number:
        po_date_str = f" — {_fmt_date(note.customer_po_date)}" if note.customer_po_date else ""
        po_row = f"""
        <div class="ref-chip">
          <label>OC Cliente</label>
          <span>{note.customer_po_number}{po_date_str}</span>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Nota de Remisión {_val(note.note_number)}</title>
  <style>
    :root {{
      --navy:  #002B5B;
      --steel: #1A5F7A;
      --teal:  #159895;
      --mint:  #57C5B6;
      --gold:  #ad9551;
      --white: #ffffff;
      --light: #f0f7f7;
      --border:#d0e8e8;
      --text:  #1a1a2e;
      --muted: #5a7080;
    }}
    * {{ margin:0; padding:0; box-sizing:border-box; }}
    body {{ font-family:Arial,Helvetica,sans-serif; font-size:11px; color:var(--text); background:#fff; }}
    @page {{ size:A4; margin:0; }}

    /* ── Header band ── */
    .header-band {{
      background:linear-gradient(135deg,var(--navy) 0%,var(--navy) 30%,var(--steel) 70%,var(--teal) 100%);
      padding:14px 24px 12px;
      display:flex; justify-content:space-between; align-items:center;
    }}
    .company-info h1 {{ font-size:18px; font-weight:700; color:var(--gold); text-transform:uppercase; letter-spacing:0.7px; margin-bottom:5px; }}
    .company-info p {{ color:rgba(255,255,255,0.82); font-size:9px; line-height:1.65; }}
    .rfc-tag {{ display:inline-block; background:var(--gold); color:var(--navy); padding:2px 8px; border-radius:3px; font-size:8.5px; font-weight:700; margin-top:4px; }}
    .logo-box {{ width:96px; height:96px; display:flex; align-items:center; justify-content:center; background:#fff; border-radius:50%; padding:7px; box-shadow:0 2px 8px rgba(0,0,0,0.25); }}
    .logo-box img {{ max-width:90px; max-height:90px; object-fit:contain; }}

    /* ── Content ── */
    .wrap {{ padding:0 24px 24px; }}

    /* ── Document header ── */
    .doc-header {{ display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding:10px 0 8px; margin-bottom:10px; }}
    .doc-title {{ font-size:16px; font-weight:700; color:var(--navy); letter-spacing:0.5px; text-transform:uppercase; }}
    .doc-badges {{ display:flex; align-items:center; gap:8px; }}
    .nr-badge {{ background:var(--navy); color:var(--mint); font-size:14px; font-weight:700; padding:4px 14px; border-radius:5px; border-left:4px solid var(--gold); }}
    .status-badge {{ font-size:9px; font-weight:700; padding:4px 10px; border-radius:4px; }}

    /* ── Date strip ── */
    .date-strip {{ font-size:10px; color:var(--muted); margin-bottom:10px; }}

    /* ── Client section ── */
    .client-section {{
      display:grid; grid-template-columns:1fr 1fr; gap:6px 14px;
      background:rgba(173,149,81,0.1); border:1px solid rgba(173,149,81,0.3);
      border-left:4px solid var(--teal); border-radius:4px; padding:8px 12px; margin-bottom:10px;
    }}
    .section-title {{ grid-column:1/-1; font-size:8px; font-weight:700; text-transform:uppercase; color:var(--teal); letter-spacing:0.8px; margin-bottom:3px; }}
    .cf label {{ font-size:7.5px; color:var(--muted); text-transform:uppercase; display:block; letter-spacing:0.4px; }}
    .cf span {{ font-size:9.5px; font-weight:600; color:var(--navy); }}

    /* ── Ref strip ── */
    .ref-strip {{ display:flex; gap:7px; margin-bottom:10px; }}
    .ref-chip {{ flex:1; background:#f8f9fb; border:1px solid var(--border); border-top:3px solid var(--steel); border-radius:0 0 3px 3px; padding:4px 8px; }}
    .ref-chip label {{ font-size:7px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; display:block; }}
    .ref-chip span {{ font-size:9.5px; font-weight:600; color:var(--navy); }}

    /* ── Table ── */
    table {{ width:100%; border-collapse:collapse; font-size:9px; }}
    thead tr {{ background:linear-gradient(90deg,var(--navy),var(--steel)); color:#fff; }}
    thead th {{ padding:6px 7px; text-align:left; font-size:8px; font-weight:600; letter-spacing:0.3px; white-space:nowrap; }}
    thead th.right {{ text-align:right; }}
    tbody tr:nth-child(even) {{ background:var(--light); }}
    tbody tr:nth-child(odd)  {{ background:var(--white); }}
    tbody td {{ padding:5px 7px; border-bottom:1px solid var(--border); vertical-align:top; }}
    .td-num {{ font-weight:700; color:var(--teal); font-size:11px; text-align:center; width:22px; }}
    .td-sku {{ font-family:'Courier New',monospace; background:#e8f4f4; color:var(--steel); border-radius:3px; padding:2px 5px !important; font-size:8.5px; white-space:nowrap; border:1px solid var(--border); }}
    .right {{ text-align:right; font-weight:600; }}
    .muted {{ color:var(--muted); font-weight:normal; }}
    .bold-green {{ text-align:right; font-weight:700; color:#059669; }}

    /* ── Totals ── */
    .totals-wrap {{ display:flex; justify-content:flex-end; border-top:2px solid var(--steel); margin-top:0; }}
    .totals-box {{ min-width:220px; border:1px solid var(--border); border-top:none; border-radius:0 0 4px 4px; overflow:hidden; }}
    .t-row {{ display:flex; justify-content:space-between; padding:4px 12px; border-bottom:1px solid var(--border); font-size:10px; }}
    .t-row label {{ color:var(--muted); }}
    .t-row span {{ font-weight:600; color:var(--navy); }}
    .t-total {{ background:linear-gradient(90deg,var(--navy),var(--steel)); border-bottom:none; }}
    .t-total label, .t-total span {{ color:var(--gold); font-size:12px; font-weight:700; }}

    /* ── Footer ── */
    .footer-wrap {{ margin-top:12px; display:grid; grid-template-columns:1fr 1fr; gap:10px; }}
    .note-block {{ background:rgba(173,149,81,0.1); border:1px solid rgba(173,149,81,0.3); border-top:3px solid var(--mint); border-radius:0 0 4px 4px; padding:8px 10px; }}
    .note-block .nb-title {{ font-size:8px; font-weight:700; text-transform:uppercase; color:var(--teal); letter-spacing:0.5px; margin-bottom:4px; }}
    .note-block p {{ font-size:9px; color:#3a5060; line-height:1.55; }}

    .bottom-bar {{ height:4px; background:linear-gradient(90deg,var(--navy),var(--teal),var(--gold)); border-radius:2px; margin:14px 24px 16px; }}
  </style>
</head>
<body>

<div class="header-band">
  <div class="company-info">
    <h1>Refacciones Tomás Badillo S.A. de C.V.</h1>
    <p>T. 55 4004 4707 &nbsp;|&nbsp; refacrtb.com.mx</p>
    <p>Av. Hda. De Sotelo Secc.2 Mz.3 Casa 10, U.Hab. Fco. Villa, Azcapotzalco, C.P. 02420, CD. de México</p>
    <span class="rfc-tag">RFC: RTB181127HC7</span>
  </div>
  <div class="logo-box">
    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWwAAAFsCAYAAADon4O5AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAAIdUAACHVAQSctJ0AAIdfSURBVHhe7d13fM3X/wfw1zmfe7MTQuwRe8aqVbtU7U1iV2lVEaMoRQm1qRm7SlErMWPUqoozlNpXbd+2b7WvWjVqVW3f9uv9fu7v90l8kt/N5N57zj15Px+PR57fk8m9OTnvs87JEUREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREQfxPQNkpTZEFH28OHDHADmzp0rGGNCX0eSzIFM2FKGQkTZbt++Xf7Zs2e36tevv9LHE+vPP/90Hjt2bNOqVauWOTo6BTo6Ol46depU586d+x1jzKR/jCRlZFzfIEkf24sXL7q3bt36k5eX19ceHh7Jeo2ePHniNHv27KlbtmyZkSNHDgdNmzb98dNPP7VXVbUdP368yhkzZswhIkX/OEnKyLi+QZI+tufPn3dv3bq1k5eX19ceHh7Jeo2ePHviNHv27KlbtmyZkSNHDgdNmzb98dNPP7VXVbUdP368yhkzZswhIkX/OEnKyLi+QZI+tufPn3dv3bq1k5eX19ceHh7Jeo2ePHviNHv27KlbtmyZkSNHDgdNmzb98dNPP7VXVbUdP368yhkzZswhIkX/OEnKyLi+QZI+tufPn3dv3bq1k5eX19ceHh7Jeo2ePHviNHv27KlbtmyZkSNHDgdNmzb98dNPP7VXVbUdP368yhkzZswhIkX/OEnKyLi+QZI+tufPn3dv3bq1k5eX19ceHh7Jeo2ePHviNHv27KlbtmyZkSNHDgdNmzb98dNPP7VXVbUdP368yhkzZswhIkX/OEnKyLi+QZI+tufPn3dv3bq1k5eX19ceHh7Jeo2ePHviNHv27KlbtmyZkSNHDgdNmzb98dNPP7VXVbUdP368yhkzZswhIkX/OEnKyLi+QZI+tufPn3dv3bq1k5eX19ceHh7Jeo2ePHviNHv27KlbtmyZkSNHDgdNmzb98dNPP7VXVbUdP368yhkzZswhIkX/OEnKyLi+QZI+tufPn3dv3bq1k5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" alt="RTB"/>
  </div>
</div>

<div class="wrap">

  <div class="doc-header">
    <span class="doc-title">Nota de Remisión</span>
    <div class="doc-badges">
      <span class="nr-badge">{_val(note.note_number)}</span>
      <span class="status-badge" style="background:{s_bg};color:{s_fg};">{status_label}</span>
    </div>
  </div>

  <div class="date-strip">
    Ciudad de México, a <strong>{_fmt_date(note.issue_date)}</strong>
    {f'&nbsp;|&nbsp; OC: <strong>{note.customer_po_number}</strong>' if note.customer_po_number else ''}
    {f'&nbsp;|&nbsp; Fecha OC: <strong>{_fmt_date(note.customer_po_date)}</strong>' if note.customer_po_date else ''}
  </div>

  <div class="client-section">
    <div class="section-title">📋 Datos del Cliente</div>
    <div class="cf"><label>Nombre comercial</label><span>{business_name}</span></div>
    <div class="cf"><label>Siglas / ID</label><span>{code}</span></div>
    <div class="cf"><label>Razón Social</label><span>{legal_name}</span></div>
    <div class="cf"><label>RFC</label><span>{rfc}</span></div>
    <div class="cf"><label>Contacto</label><span>{contact_name}</span></div>
    <div class="cf"><label>Teléfono</label><span>{contact_phone}</span></div>
    <div class="cf"><label>Email</label><span>{contact_email}</span></div>
    <div class="cf"><label>Condiciones de pago</label><span>{payment_terms}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:22px">#</th>
        <th>SKU</th>
        <th>Descripción</th>
        <th class="right" style="width:45px">Cant.</th>
        <th class="right" style="width:70px">P. Unitario</th>
        <th class="right" style="width:60px">Desc.</th>
        <th class="right" style="width:70px">P. Neto</th>
        <th class="right" style="width:75px">Subtotal</th>
        <th class="right" style="width:60px">IVA</th>
        <th class="right" style="width:75px">Total</th>
      </tr>
    </thead>
    <tbody>
      {item_rows}
    </tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals-box">
      <div class="t-row"><label>Subtotal</label><span>{_fmt_mxn(subtotal)}</span></div>
      <div class="t-row"><label>IVA (16%)</label><span>{_fmt_mxn(tax_amount)}</span></div>
      <div class="t-row t-total"><label>TOTAL</label><span>{_fmt_mxn(total)}</span></div>
    </div>
  </div>

  <div class="footer-wrap">
    <div class="note-block">
      <div class="nb-title">📝 Notas</div>
      <p>{_val(note.notes, 'Sin observaciones.')}</p>
    </div>
    <div class="note-block">
      <div class="nb-title">ℹ️ Condiciones</div>
      <p>
        <strong>Pago:</strong> {payment_terms}<br/>
        <strong>Precios:</strong> En MXN más IVA.<br/>
        <strong>Documento:</strong> Nota de remisión — no es CFDI.
      </p>
    </div>
  </div>

</div>
<div class="bottom-bar"></div>
</body>
</html>"""


# ── PDF generation ───────────────────────────────────────────────────────────

def _render_pdf(html: str) -> bytes:
    import weasyprint  # noqa: PLC0415 — deferred to avoid startup cost
    return weasyprint.HTML(string=html).write_pdf()


async def generate_delivery_note_pdf(
    note: "DeliveryNote",
    customer: "CustomerMaster",
) -> bytes:
    """Generate PDF bytes for a delivery note.  Runs weasyprint in a thread."""
    html = _build_html(note, customer)
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(_render_pdf, html))

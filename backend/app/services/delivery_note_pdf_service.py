"""Generación de PDF para Notas de Remisión.

HTML renderizado vía Jinja2 Template. PDF generado con weasyprint
ejecutado en un thread executor para no bloquear el event loop.
"""

from __future__ import annotations

import asyncio
import base64
import os
from functools import partial


# ── Helpers ───────────────────────────────────────────────────────────────────

MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def fmt_date(value) -> str:
    if not value:
        return "—"
    if isinstance(value, str):
        try:
            from datetime import datetime
            value = datetime.strptime(value[:10], "%Y-%m-%d").date()
        except Exception:
            return str(value)
    return f"{value.day} de {MESES[value.month - 1]} de {value.year}"


def fmt_money(value) -> str:
    if value is None:
        return "$0.00"
    try:
        return f"${float(value):,.2f}"
    except Exception:
        return "$0.00"


def val(v, fb: str = "—") -> str:
    if v is None or v == "" or v == "null":
        return fb
    return str(v)


def build_address(addr: dict) -> str:
    if not addr:
        return "—"
    parts = []
    street = addr.get("street", "")
    ext    = addr.get("exterior_number", "")
    inte   = addr.get("interior_number", "")
    if street:
        line = street
        if ext:  line += f" #{ext}"
        if inte: line += f" Int. {inte}"
        parts.append(line)
    if addr.get("neighborhood"): parts.append(addr["neighborhood"])
    city_state = ", ".join(filter(None, [addr.get("city"), addr.get("state")]))
    if city_state: parts.append(city_state)
    if addr.get("zip_code"):  parts.append(f"C.P. {addr['zip_code']}")
    if addr.get("country") and addr["country"] not in ("México", "Mexico", "MX"):
        parts.append(addr["country"])
    return ", ".join(parts) if parts else "—"


# ── Logo RTB (PNG → file URI) ─────────────────────────────────────────────────
# Se lee el archivo PNG en tiempo de ejecución para generar un data URI
# que WeasyPrint puede renderizar sin depender de rutas externas.

_LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "static", "logo.png")


def _logo_data_uri() -> str:
    """Lee logo.png y devuelve un data URI PNG base64 para WeasyPrint."""
    try:
        with open(_LOGO_PATH, "rb") as f:
            data = f.read()
        return f"data:image/png;base64,{base64.b64encode(data).decode()}"
    except Exception:
        return ""


# ── Jinja2 HTML Template ──────────────────────────────────────────────────────
# CSS optimizado para WeasyPrint:
#  • display:grid → display:flex / width:XX% (grid tiene soporte parcial)
#  • linear-gradient mantiene fallback de color sólido
#  • Logo como SVG inline para máxima compatibilidad

TEMPLATE_STR = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Nota de Remisión {{ note.note_number }}</title>
  <style>
    :root {
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
    }
    @page { margin: 0; size: A4; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:Arial,sans-serif; font-size:11px; color:var(--text); background:#fff; }
    .page { background:var(--white); }

    .header-band {
      background:#002B5B;
      background:linear-gradient(135deg,#002B5B 0%,#002B5B 25%,#159895 75%,#159895 100%);
      padding:14px 20px 12px;
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:12px;
    }
    .company-info { flex:1; }
    .company-info h1 { font-size:20px; font-weight:700; color:#ad9551; text-transform:uppercase; letter-spacing:.8px; margin-bottom:6px; }
    .company-info p  { color:rgba(255,255,255,.85); font-size:9.5px; line-height:1.65; }
    .rfc-tag { display:inline-block; background:#ad9551; color:#002B5B; padding:2px 8px; border-radius:3px; font-size:9px; font-weight:700; margin-top:4px; letter-spacing:.5px; }
    .logo-box { width:110px; height:110px; display:flex; align-items:center; justify-content:center; background:#fff; border-radius:50%; box-shadow:0 2px 8px rgba(0,0,0,.25); }
    .logo-box img { max-width:110px; max-height:110px; }

    .content-wrap { padding:0 20px 20px; }

    .meta-row { display:block; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid var(--border); }
    .meta-row .date { display:block; font-size:10px; color:var(--muted); margin-bottom:2px; white-space:nowrap; }
    .nr-badge { display:inline-flex; align-items:center; gap:6px; background:var(--navy); color:var(--white); padding:4px 8px; border-radius:5px; border-left:4px solid var(--gold); margin-left:0; }
    .nr-badge { display:flex; align-items:center; gap:6px; background:var(--navy); color:var(--white); padding:4px 8px; border-radius:5px; border-left:4px solid var(--gold); }
    .nr-badge .doc-type { font-size:8.5px; font-weight:600; opacity:.75; text-transform:uppercase; letter-spacing:.5px; }
    .nr-badge .doc-num  { font-size:12px; font-weight:700; color:var(--mint); }

    .status-chip { display:inline-block; padding:3px 10px; border-radius:4px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; margin-left:8px; }
    .status-APROBADA  { background:#ddf4f0; color:var(--teal);  border:1px solid var(--teal); }
    .status-EDICION   { background:#fff8e0; color:#9a7000;      border:1px solid #d4aa00; }
    .status-CANCELADA { background:#fde8e8; color:#c0392b;      border:1px solid #c0392b; }

    .client-section {
      display:flex;
      flex-wrap:wrap;
      background:rgba(173,149,81,.12);
      border:1px solid rgba(173,149,81,.3);
      border-left:4px solid var(--teal);
      border-radius:4px;
      padding:8px 12px;
      margin-bottom:10px;
    }
    .block-title { width:100%; font-size:8.5px; font-weight:700; text-transform:uppercase; color:var(--teal); letter-spacing:.8px; margin-bottom:2px; }
    .cf { width:50%; padding:2px 4px; }
    .cf.full  { width:100%; }
    .cf label { font-size:8px; color:var(--muted); text-transform:uppercase; display:block; letter-spacing:.4px; }
    .cf span  { font-size:10px; font-weight:600; color:var(--navy); }

    .ref-strip { display:flex; gap:7px; margin-bottom:10px; }
    .ref-chip { flex:1; background:#f8f9fb; border:1px solid var(--border); border-top:3px solid var(--steel); border-radius:0 0 3px 3px; padding:4px 8px; }
    .ref-chip label { font-size:7.5px; color:var(--muted); text-transform:uppercase; letter-spacing:.5px; display:block; }
    .ref-chip span  { font-size:10px; font-weight:600; color:var(--navy); }

    .products-table { width:100%; border-collapse:collapse; font-size:9.5px; }
    .products-table thead tr { background:#002B5B; background:linear-gradient(90deg,#002B5B,#1A5F7A); color:var(--white); }
    .products-table thead th { padding:7px 8px; text-align:left; font-weight:600; font-size:8.5px; letter-spacing:.3px; white-space:nowrap; }
    .products-table thead th.right  { text-align:right; }
    .products-table thead th.center { text-align:center; }
    .products-table tbody tr:nth-child(even) { background:var(--light); }
    .products-table tbody tr:nth-child(odd)  { background:var(--white); }
    .products-table tbody td { padding:5px 8px; border-bottom:1px solid var(--border); vertical-align:top; }
    .products-table tbody td.right  { text-align:right; font-weight:600; }
    .products-table tbody td.center { text-align:center; }
    .td-num { font-weight:700; color:var(--teal); font-size:12px; text-align:center; width:28px; }
    .td-sku { font-family:'Courier New',monospace; background:#e8f4f4; color:var(--steel); border-radius:3px; padding:2px 5px !important; font-size:9px; white-space:nowrap; border:1px solid var(--border); }
    .td-img { width:44px; text-align:center; }
    .td-img img { width:38px; height:38px; object-fit:contain; border-radius:3px; border:1px solid var(--border); }
    .no-img { width:38px; height:38px; background:#f0f4f8; border:1px dashed var(--border); border-radius:3px; display:inline-flex; align-items:center; justify-content:center; font-size:7px; color:#aaa; }
    .td-name { font-weight:600; color:var(--navy); }
    .td-note { color:var(--muted); font-size:8.5px; line-height:1.4; margin-top:2px; }

    .totals-section { display:flex; justify-content:flex-end; border-top:2px solid var(--steel); }
    .totals-box { min-width:230px; border:1px solid var(--border); border-top:none; border-radius:0 0 5px 5px; overflow:hidden; }
    .t-row { display:flex; justify-content:space-between; padding:4px 13px; border-bottom:1px solid var(--border); font-size:10px; }
    .t-row label { color:var(--muted); }
    .t-row span  { font-weight:600; color:var(--navy); }
    .t-row.total-final { background:#002B5B; background:linear-gradient(90deg,#002B5B,#1A5F7A); border-bottom:none; }
    .t-row.total-final label,
    .t-row.total-final span { color:var(--gold); font-size:12px; font-weight:700; }

    .footer-section { margin-top:12px; display:flex; gap:10px; }
    .note-block { flex:1; background:rgba(173,149,81,.12); border:1px solid rgba(173,149,81,.3); border-top:3px solid var(--mint); border-radius:0 0 4px 4px; padding:8px 10px; }
    .note-block .nb-title { font-size:8.5px; font-weight:700; text-transform:uppercase; color:var(--teal); letter-spacing:.5px; margin-bottom:4px; }
    .note-block p { font-size:9.5px; color:#3a5060; line-height:1.55; }

    .firma-section { margin-top:32px; display:flex; gap:60px; }
    .firma-box { flex:1; text-align:center; }
    .firma-line { border-top:1px solid var(--navy); padding-top:5px; }
    .firma-name { font-size:10px; font-weight:700; color:var(--navy); }
    .firma-role { font-size:8.5px; color:var(--muted); }

    .bottom-bar { height:4px; background:#002B5B; background:linear-gradient(90deg,#002B5B,#159895,#ad9551); border-radius:2px; margin:16px 20px 0; }
  </style>
</head>
<body>
<div class="page">

  <div class="header-band">
    <div class="company-info">
      <h1>Refacciones Tomás Badillo S.A. de C.V.</h1>
      <p>T. 55 4004 4707 &nbsp;|&nbsp; refacrtb.com.mx</p>
      <p>Av. Hda. De Sotelo Secc.2 Mz.3 Casa 10, U.Hab. Fco. Villa, Azcapotzalco, C.P. 02420, CD. de México</p>
      <span class="rfc-tag">RFC: RTB181127HC7</span>
    </div>
    <div class="logo-box">
      <img src="{{ logo_data_uri }}" alt="RTB Logo"/>
    </div>
  </div>

  <div class="content-wrap">

    <div class="meta-row">
      <span class="date">
        Ciudad de México, a <strong>{{ fmt_date(note.get('issue_date')) }}</strong>
        <span class="status-chip status-{{ note.get('status','EDICION') }}">{{ note.get('status','—') }}</span>
      </span>
      <div class="nr-badge">
        <span class="doc-type">Nota de Remisión</span>
        <span class="doc-num">{{ note.get('note_number','—') }}</span>
      </div>
    </div>

    <div class="client-section">
      <div class="block-title">Datos del Cliente</div>
      <div class="cf"><label>Nombre</label><span>{{ val(customer.get('business_name')) }}</span></div>
      <div class="cf"><label>Código / Siglas</label><span>{{ val(customer.get('code')) }}</span></div>
      {% if tax_data %}
      <div class="cf"><label>Razón Social</label><span>{{ val(tax_data.get('legal_name')) }}</span></div>
      <div class="cf"><label>RFC</label><span>{{ val(tax_data.get('rfc')) }}</span></div>
      {% endif %}
      {% if primary_contact %}
      <div class="cf"><label>Contacto</label><span>{{ val(primary_contact.get('full_name')) }}{% if primary_contact.get('role_title') %} — {{ primary_contact.get('role_title') }}{% endif %}</span></div>
      <div class="cf"><label>Teléfono</label><span>{{ val(primary_contact.get('phone')) }}</span></div>
      <div class="cf full"><label>Email</label><span>{{ val(primary_contact.get('email')) }}</span></div>
      {% endif %}
      {% if shipping_address %}
      <div class="cf full"><label>Dirección de Entrega</label><span>{{ build_address(shipping_address) }}</span></div>
      {% endif %}
    </div>

    <div class="ref-strip">
      <div class="ref-chip"><label>PO Cliente</label><span>{{ val(note.get('customer_po_number')) }}</span></div>
      <div class="ref-chip"><label>Fecha PO</label><span>{{ fmt_date(note.get('customer_po_date')) }}</span></div>
      <div class="ref-chip"><label>Fecha Entrega</label><span>{{ fmt_date(note.get('delivery_date')) }}</span></div>
    </div>

    <table class="products-table">
      <thead>
        <tr>
          <th class="center">#</th>
          <th>Img</th>
          <th>SKU</th>
          <th>Descripción</th>
          <th class="center">Cant.</th>
          <th class="right">P. Unitario</th>
          <th class="right">Descuento</th>
          <th class="right">Subtotal</th>
          <th class="right">IVA</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        {% for item in items %}
        {% set prod = item.get('product') or {} %}
        <tr>
          <td class="td-num">{{ loop.index }}</td>
          <td class="td-img">
            {% if prod.get('image_url') %}
              <img src="{{ prod.image_url }}" alt="producto"/>
            {% else %}
              <div class="no-img">sin<br>img</div>
            {% endif %}
          </td>
          <td><span class="td-sku">{{ val(item.get('sku')) }}</span></td>
          <td>
            <div class="td-name">{{ val(item.get('description')) }}</div>
            {% if item.get('notes') %}<div class="td-note">{{ item.get('notes') }}</div>{% endif %}
          </td>
          <td class="center">{{ item.get('quantity', 1) | float | int if (item.get('quantity', 1) | float) == (item.get('quantity', 1) | float | int) else item.get('quantity', 1) | float }}</td>
          <td class="right">{{ fmt_money(item.get('unit_price')) }}</td>
          <td class="right">{{ fmt_money(item.get('discount_amount')) if item.get('discount_amount') and item.get('discount_amount') | float > 0 else '—' }}</td>
          <td class="right">{{ fmt_money(item.get('subtotal')) }}</td>
          <td class="right">{{ fmt_money(item.get('tax_amount')) }}</td>
          <td class="right">{{ fmt_money(item.get('total')) }}</td>
        </tr>
        {% endfor %}
      </tbody>
    </table>

    <div class="totals-section">
      <div class="totals-box">
        <div class="t-row"><label>Subtotal</label><span>{{ fmt_money(note.get('subtotal')) }}</span></div>
        <div class="t-row"><label>IVA</label><span>{{ fmt_money(note.get('tax_amount')) }}</span></div>
        <div class="t-row total-final"><label>TOTAL</label><span>{{ fmt_money(note.get('total')) }}</span></div>
      </div>
    </div>

    <div class="footer-section">
      <div class="note-block">
        <div class="nb-title">Notas</div>
        <p>{{ val(note.get('notes')) }}</p>
      </div>
      <div class="note-block">
        <div class="nb-title">Condiciones</div>
        <p>
          <strong>Documento:</strong> {{ note.get('note_number','—') }}<br/>
          <strong>Emisión:</strong> {{ fmt_date(note.get('issue_date')) }}<br/>
          <strong>Precios:</strong> En MXN. IVA desglosado por partida.
        </p>
      </div>
    </div>

    <div class="firma-section">
      <div class="firma-box">
        <div style="height:48px;"></div>
        <div class="firma-line">
          <div class="firma-name">Refacciones Tomás Badillo S.A. de C.V.</div>
          <div class="firma-role">Autorizado por</div>
        </div>
      </div>
      <div class="firma-box">
        <div style="height:48px;"></div>
        <div class="firma-line">
          <div class="firma-name">{{ val(customer.get('business_name')) }}</div>
          <div class="firma-role">Recibido conforme por</div>
        </div>
      </div>
    </div>

  </div>
  <div class="bottom-bar"></div>
</div>
</body>
</html>"""


# ── Render functions ──────────────────────────────────────────────────────────

def render_nota_remision(data: dict) -> str:
    """Render the delivery note HTML from a data dict. Returns HTML string."""
    from jinja2 import Template
    tmpl = Template(TEMPLATE_STR)
    return tmpl.render(
        logo_data_uri    = _logo_data_uri(),
        note             = data.get("note", {}),
        items            = data.get("items", []),
        customer         = data.get("customer", {}),
        tax_data         = data.get("tax_data"),
        primary_contact  = data.get("primary_contact"),
        shipping_address = data.get("shipping_address"),
        fmt_date         = fmt_date,
        fmt_money        = fmt_money,
        val              = val,
        build_address    = build_address,
    )


def _render_pdf(html: str) -> bytes:
    """Convert HTML to PDF bytes via weasyprint (deferred import)."""
    import weasyprint  # noqa: PLC0415 — deferred to avoid startup cost
    return weasyprint.HTML(string=html, encoding="utf-8").write_pdf()


async def generate_delivery_note_pdf(data: dict) -> bytes:
    """Generate PDF bytes for a delivery note. Runs weasyprint in a thread executor."""
    html = render_nota_remision(data)
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(_render_pdf, html))

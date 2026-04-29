from __future__ import annotations

import base64
import logging
from datetime import date

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_MAILERSEND_URL = "https://api.mailersend.com/v1/email"


class EmailError(Exception):
    pass


async def _send_report(
    *,
    report_title: str,
    to_email: str,
    start_date: date | None,
    end_date: date | None,
    docx_bytes: bytes,
    csv_bytes: bytes,
    docx_filename: str,
    csv_filename: str,
) -> None:
    if not settings.MAILERSEND_API_TOKEN:
        raise EmailError(
            "MAILERSEND_API_TOKEN no configurado en las variables de entorno."
        )

    period = _period_label(start_date, end_date)
    subject = f"{report_title} — {period}"
    html_body = _build_html(report_title, period)
    text_body = _build_text(report_title, period)

    payload = {
        "from": {
            "email": settings.MAILERSEND_FROM_EMAIL,
            "name": settings.MAILERSEND_FROM_NAME,
        },
        "to": [{"email": to_email}],
        "subject": subject,
        "html": html_body,
        "text": text_body,
        "attachments": [
            {
                "filename": docx_filename,
                "content": base64.b64encode(docx_bytes).decode(),
                "disposition": "attachment",
            },
            {
                "filename": csv_filename,
                "content": base64.b64encode(csv_bytes).decode(),
                "disposition": "attachment",
            },
        ],
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            _MAILERSEND_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.MAILERSEND_API_TOKEN}",
                "Content-Type": "application/json",
            },
        )

    if resp.status_code not in (200, 202):
        logger.error("MailerSend error %s: %s", resp.status_code, resp.text)
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        raise EmailError(f"MailerSend respondió {resp.status_code}: {detail}")

    logger.info(
        "Reporte enviado a %s via MailerSend (status %s)", to_email, resp.status_code
    )


async def send_ventas_report(
    *,
    to_email: str,
    start_date: date | None,
    end_date: date | None,
    docx_bytes: bytes,
    csv_bytes: bytes,
    docx_filename: str,
    csv_filename: str,
) -> None:
    await _send_report(
        report_title="Reporte de Ventas",
        to_email=to_email,
        start_date=start_date,
        end_date=end_date,
        docx_bytes=docx_bytes,
        csv_bytes=csv_bytes,
        docx_filename=docx_filename,
        csv_filename=csv_filename,
    )


async def send_almacen_report(
    *,
    to_email: str,
    start_date: date | None,
    end_date: date | None,
    docx_bytes: bytes,
    csv_bytes: bytes,
    docx_filename: str,
    csv_filename: str,
) -> None:
    await _send_report(
        report_title="Reporte de Almacén",
        to_email=to_email,
        start_date=start_date,
        end_date=end_date,
        docx_bytes=docx_bytes,
        csv_bytes=csv_bytes,
        docx_filename=docx_filename,
        csv_filename=csv_filename,
    )


def _period_label(start_date: date | None, end_date: date | None) -> str:
    if start_date and end_date:
        return f"{start_date.strftime('%d/%m/%Y')} — {end_date.strftime('%d/%m/%Y')}"
    if start_date:
        return f"Desde {start_date.strftime('%d/%m/%Y')}"
    if end_date:
        return f"Hasta {end_date.strftime('%d/%m/%Y')}"
    return "Histórico completo"


def _build_html(report_title: str, period: str) -> str:
    return f"""
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#1f2937;max-width:600px;margin:0 auto;padding:24px">
  <div style="background:#1e40af;padding:24px 32px;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:22px">{report_title}</h1>
    <p style="color:#bfdbfe;margin:8px 0 0">Nexus Ops RTB</p>
  </div>
  <div style="background:#f9fafb;padding:24px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
    <p style="margin:0 0 12px"><strong>Periodo:</strong> {period}</p>
    <p style="margin:0 0 20px;color:#6b7280">
      Adjunto encontrarás el reporte en formato <strong>DOCX</strong>
      y los datos en formato <strong>CSV</strong>.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr style="background:#e0e7ff">
        <td style="padding:10px 14px;font-weight:bold;color:#3730a3">Archivo</td>
        <td style="padding:10px 14px;font-weight:bold;color:#3730a3">Descripción</td>
      </tr>
      <tr style="background:#fff">
        <td style="padding:10px 14px;border-top:1px solid #e5e7eb">📄 Reporte .docx</td>
        <td style="padding:10px 14px;border-top:1px solid #e5e7eb">Informe ejecutivo con tablas y KPIs</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:10px 14px;border-top:1px solid #e5e7eb">📊 Datos .csv</td>
        <td style="padding:10px 14px;border-top:1px solid #e5e7eb">Datos crudos para análisis en Excel</td>
      </tr>
    </table>
    <p style="color:#9ca3af;font-size:12px;margin:0">
      Este correo fue generado automáticamente por Nexus Ops RTB. No responder a este mensaje.
    </p>
  </div>
</body>
</html>
""".strip()


def _build_text(report_title: str, period: str) -> str:
    return (
        f"{report_title} — Nexus Ops RTB\n"
        f"Periodo: {period}\n\n"
        "Adjunto encontrarás el reporte en formato DOCX y los datos en CSV.\n\n"
        "Este correo fue generado automáticamente por Nexus Ops RTB."
    )


async def send_password_reset_email(to_email: str, reset_url: str) -> None:
    if not settings.MAILERSEND_API_TOKEN:
        logger.warning("MAILERSEND_API_TOKEN no configurado — email de reset omitido")
        return

    html_body = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#0f1115;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1115;padding:40px 16px;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0"
           style="background:#1a1d21;border:1px solid #2a2d33;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:32px 40px 24px;border-bottom:1px solid #2a2d33;">
          <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.08em;color:#6b7280;text-transform:uppercase;">Nexus Ops RTB</p>
          <h1 style="margin:8px 0 0;font-size:22px;font-weight:600;color:#f3f4f6;">Restablecer contraseña</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 40px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#9ca3af;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta.
            Si no fuiste tú, puedes ignorar este correo.
          </p>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#9ca3af;">
            El enlace expira en <strong style="color:#d1d5db;">1 hora</strong>.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-radius:8px;background:#3b82f6;">
                <a href="{reset_url}"
                   style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;
                          color:#ffffff;text-decoration:none;border-radius:8px;">
                  Restablecer contraseña
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:28px 0 0;font-size:12px;color:#6b7280;word-break:break-all;">
            Si el botón no funciona, copia este enlace:<br/>
            <a href="{reset_url}" style="color:#6b7280;">{reset_url}</a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 40px;border-top:1px solid #2a2d33;">
          <p style="margin:0;font-size:12px;color:#4b5563;">Enviado desde Nexus Ops RTB. No respondas a este correo.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>""".strip()

    payload = {
        "from": {
            "email": settings.MAILERSEND_FROM_EMAIL,
            "name": settings.MAILERSEND_FROM_NAME,
        },
        "to": [{"email": to_email}],
        "subject": "Restablecer contraseña — Nexus Ops RTB",
        "html": html_body,
        "text": (
            f"Recibimos una solicitud para restablecer la contraseña de tu cuenta.\n\n"
            f"Haz clic en el siguiente enlace (expira en 1 hora):\n{reset_url}\n\n"
            "Si no solicitaste esto, ignora este correo."
        ),
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            _MAILERSEND_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.MAILERSEND_API_TOKEN}",
                "Content-Type": "application/json",
            },
        )

    if resp.status_code not in (200, 202):
        logger.error("MailerSend reset error %s: %s", resp.status_code, resp.text[:300])
        raise EmailError(f"No se pudo enviar el correo de restablecimiento ({resp.status_code})")

from __future__ import annotations

import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user_model import User
from app.services.email_service import EmailError, send_ventas_report
from app.services.report_service import ReportService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reportes", tags=["reportes"])


# ── Modelos de request ─────────────────────────────────────────────────────────

class EnviarReporteRequest(BaseModel):
    to_email: EmailStr
    start_date: date | None = None
    end_date: date | None = None
    sections: list[str] = ["kpis", "clientes", "productos", "margen", "pagos", "riesgo"]


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/ventas")
async def generar_reporte_ventas(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    sections: str = Query(
        default="kpis,clientes,productos,margen,pagos,riesgo",
        description="Secciones separadas por coma: kpis, clientes, productos, margen, pagos, riesgo",
    ),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Response:
    """Genera y descarga un reporte de ventas en formato DOCX."""
    section_list = [s.strip() for s in sections.split(",") if s.strip()]
    try:
        service = ReportService(db)
        content = await service.generate_ventas_docx(
            start_date=start_date,
            end_date=end_date,
            sections=section_list,
        )
    except Exception as exc:
        logger.exception("Error generando reporte de ventas: %s", exc)
        raise HTTPException(status_code=500, detail="Error al generar el reporte") from exc

    filename = _build_docx_filename(start_date, end_date)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/ventas/enviar-correo", status_code=200)
async def enviar_reporte_por_correo(
    body: EnviarReporteRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict[str, str]:
    """Genera el reporte DOCX + CSV y los envía como adjuntos por correo."""
    section_list = [s.strip().lower() for s in body.sections if s.strip()]

    try:
        service = ReportService(db)
        docx_bytes, csv_bytes = await _generate_both(
            service, body.start_date, body.end_date, section_list
        )
    except Exception as exc:
        logger.exception("Error generando archivos para envío: %s", exc)
        raise HTTPException(status_code=500, detail="Error al generar el reporte") from exc

    docx_filename = _build_docx_filename(body.start_date, body.end_date)
    csv_filename = docx_filename.replace(".docx", ".csv")

    try:
        await send_ventas_report(
            to_email=str(body.to_email),
            start_date=body.start_date,
            end_date=body.end_date,
            docx_bytes=docx_bytes,
            csv_bytes=csv_bytes,
            docx_filename=docx_filename,
            csv_filename=csv_filename,
        )
    except EmailError as exc:
        logger.error("Error enviando correo: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Error inesperado enviando correo: %s", exc)
        raise HTTPException(status_code=500, detail="Error al enviar el correo") from exc

    return {"message": f"Reporte enviado a {body.to_email}"}


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _generate_both(
    service: ReportService,
    start_date: date | None,
    end_date: date | None,
    sections: list[str],
) -> tuple[bytes, bytes]:
    docx_bytes = await service.generate_ventas_docx(
        start_date=start_date, end_date=end_date, sections=sections
    )
    csv_bytes = await service.generate_ventas_csv(
        start_date=start_date, end_date=end_date, sections=sections
    )
    return docx_bytes, csv_bytes


def _build_docx_filename(start_date: date | None, end_date: date | None) -> str:
    if start_date and end_date:
        return f"reporte_ventas_{start_date}_{end_date}.docx"
    if start_date:
        return f"reporte_ventas_desde_{start_date}.docx"
    if end_date:
        return f"reporte_ventas_hasta_{end_date}.docx"
    return "reporte_ventas.docx"

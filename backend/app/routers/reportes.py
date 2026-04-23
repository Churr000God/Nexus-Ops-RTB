from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user_model import User
from app.services.report_service import ReportService

router = APIRouter(prefix="/api/reportes", tags=["reportes"])


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
    service = ReportService(db)
    content = await service.generate_ventas_docx(
        start_date=start_date,
        end_date=end_date,
        sections=section_list,
    )

    filename = _build_filename(start_date, end_date)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _build_filename(start_date: date | None, end_date: date | None) -> str:
    if start_date and end_date:
        return f"reporte_ventas_{start_date}_{end_date}.docx"
    if start_date:
        return f"reporte_ventas_desde_{start_date}.docx"
    if end_date:
        return f"reporte_ventas_hasta_{end_date}.docx"
    return "reporte_ventas.docx"

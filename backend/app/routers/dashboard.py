from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user_model import User
from app.schemas.venta_schema import DashboardOverviewResponse
from app.services.ventas_service import VentasService

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardOverviewResponse)
async def overview(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DashboardOverviewResponse:
    service = VentasService(db)
    return await service.dashboard_overview(start_date=start_date, end_date=end_date)

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user_model import User
from app.schemas.venta_schema import (
    ApprovedVsCancelledByMonthResponse,
    GrossMarginByProductResponse,
    SaleResponse,
    SalesByCustomerResponse,
    SalesByMonthResponse,
)
from app.services.ventas_service import VentasService

router = APIRouter(prefix="/api/ventas", tags=["ventas"])


@router.get("/", response_model=list[SaleResponse])
async def list_sales(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SaleResponse]:
    service = VentasService(db)
    return await service.list_sales(
        start_date=start_date, end_date=end_date, limit=limit, offset=offset
    )


@router.get("/by-month", response_model=list[SalesByMonthResponse])
async def sales_by_month(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SalesByMonthResponse]:
    service = VentasService(db)
    return await service.sales_by_month(start_date=start_date, end_date=end_date)


@router.get("/by-customer", response_model=list[SalesByCustomerResponse])
async def sales_by_customer(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SalesByCustomerResponse]:
    service = VentasService(db)
    return await service.sales_by_customer(
        start_date=start_date, end_date=end_date, limit=limit
    )


@router.get(
    "/gross-margin-by-product", response_model=list[GrossMarginByProductResponse]
)
async def gross_margin_by_product(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[GrossMarginByProductResponse]:
    service = VentasService(db)
    return await service.gross_margin_by_product(
        start_date=start_date, end_date=end_date, limit=limit
    )


@router.get(
    "/approved-vs-cancelled", response_model=list[ApprovedVsCancelledByMonthResponse]
)
async def approved_vs_cancelled(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ApprovedVsCancelledByMonthResponse]:
    service = VentasService(db)
    return await service.approved_vs_cancelled_by_month(
        start_date=start_date, end_date=end_date
    )

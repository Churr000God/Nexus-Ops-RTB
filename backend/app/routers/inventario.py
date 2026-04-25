from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user_model import User
from app.schemas.inventario_schema import InventarioKpiResponse, InventarioProductoResponse
from app.services.inventario_service import InventarioService

router = APIRouter(prefix="/api/inventario", tags=["inventario"])


@router.get("/kpis", response_model=InventarioKpiResponse)
async def inventario_kpis(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> InventarioKpiResponse:
    return await InventarioService(db).get_kpis()


@router.get("/productos", response_model=list[InventarioProductoResponse])
async def inventario_productos(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    solo_con_stock: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[InventarioProductoResponse]:
    return await InventarioService(db).get_productos(
        limit=limit, offset=offset, solo_con_stock=solo_con_stock
    )

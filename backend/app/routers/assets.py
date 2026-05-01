from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user_model import User
from app.schemas.assets_schema import (
    AssetAssignmentRead,
    AssetComponentCreate,
    AssetComponentDetailRead,
    AssetComponentHistoryRead,
    AssetCreate,
    AssetRead,
    AssetUpdate,
    AssignAssetPayload,
    InventoryCurrentRead,
    InventoryKpiSummaryRead,
    InventorySnapshotRead,
    RemoveComponentRequest,
    RetireAssetPayload,
)
from app.services.assets_service import AssetService

router = APIRouter(prefix="/api/assets", tags=["assets"])


# ── Assets ───────────────────────────────────────────────────────────────────

@router.get("", response_model=list[AssetRead])
async def list_assets(
    status: str | None = Query(default=None),
    asset_type: str | None = Query(default=None),
    location: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AssetRead]:
    return await AssetService(db).list_assets(
        status=status, asset_type=asset_type, location=location, limit=limit, offset=offset
    )


@router.post("", response_model=AssetRead, status_code=status.HTTP_201_CREATED)
async def create_asset(
    data: AssetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetRead:
    return await AssetService(db).create_asset(data, current_user.id)


@router.get("/{asset_id}", response_model=AssetRead)
async def get_asset(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> AssetRead:
    asset = await AssetService(db).get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset no encontrado")
    return asset


@router.patch("/{asset_id}", response_model=AssetRead)
async def update_asset(
    asset_id: UUID,
    data: AssetUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> AssetRead:
    asset = await AssetService(db).update_asset(asset_id, data)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset no encontrado")
    return asset


# ── Componentes ───────────────────────────────────────────────────────────────

@router.get("/{asset_id}/components", response_model=list[AssetComponentDetailRead])
async def get_components(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AssetComponentDetailRead]:
    return await AssetService(db).get_components(asset_id)


@router.post(
    "/{asset_id}/components",
    response_model=AssetComponentDetailRead,
    status_code=status.HTTP_201_CREATED,
)
async def install_component(
    asset_id: UUID,
    data: AssetComponentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetComponentDetailRead:
    return await AssetService(db).install_component(asset_id, data, current_user.id)


@router.post("/{asset_id}/components/{component_id}/remove", response_model=dict, status_code=status.HTTP_200_OK)
async def remove_component(
    asset_id: UUID,
    component_id: UUID,
    data: RemoveComponentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    await AssetService(db).remove_component(component_id, data, current_user.id)
    return {"ok": True}


# ── Asignaciones ─────────────────────────────────────────────────────────────

@router.get("/{asset_id}/assignments", response_model=list[AssetAssignmentRead])
async def get_assignments(
    asset_id: UUID,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AssetAssignmentRead]:
    return await AssetService(db).get_assignments(asset_id, limit=limit, offset=offset)


@router.post("/{asset_id}/assign", response_model=AssetAssignmentRead, status_code=status.HTTP_201_CREATED)
async def assign_asset(
    asset_id: UUID,
    data: AssignAssetPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetAssignmentRead:
    try:
        return await AssetService(db).assign_asset(asset_id, data, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ── Retiro ───────────────────────────────────────────────────────────────────

@router.post("/{asset_id}/retire", response_model=AssetRead)
async def retire_asset(
    asset_id: UUID,
    data: RetireAssetPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetRead:
    try:
        return await AssetService(db).retire_asset(asset_id, data, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ── Historial ─────────────────────────────────────────────────────────────────

@router.get("/{asset_id}/history", response_model=list[AssetComponentHistoryRead])
async def get_history(
    asset_id: UUID,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AssetComponentHistoryRead]:
    return await AssetService(db).get_history(asset_id, limit=limit, offset=offset)


# ── Snapshots (bajo /api/assets/snapshots para separar del inventario) ────────

snapshot_router = APIRouter(prefix="/api/inventario/snapshots", tags=["inventario"])


@snapshot_router.get("", response_model=list[InventorySnapshotRead])
async def list_snapshots(
    product_id: UUID | None = Query(default=None),
    limit: int = Query(default=12, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[InventorySnapshotRead]:
    return await AssetService(db).list_snapshots(product_id=product_id, limit=limit)


@snapshot_router.post("/close-month", response_model=dict)
async def close_monthly_snapshot(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    count = await AssetService(db).close_monthly_snapshot()
    return {"productos_snapshooteados": count}


# ── Inventario actual (vistas nuevas) ─────────────────────────────────────────

inventory_router = APIRouter(prefix="/api/inventario", tags=["inventario"])


@inventory_router.get("/kpis-v2", response_model=InventoryKpiSummaryRead)
async def inventory_kpi_summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> InventoryKpiSummaryRead:
    return await AssetService(db).get_inventory_kpi_summary()


@inventory_router.get("/vendible", response_model=list[InventoryCurrentRead])
async def inventory_vendible(
    stock_status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    sort_by: str = Query(default="total_value"),
    sort_order: str = Query(default="desc"),
    limit: int = Query(default=2000, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[InventoryCurrentRead]:
    return await AssetService(db).get_inventory_current(
        is_saleable=True,
        stock_status=stock_status,
        search=search,
        category=category,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
    )


@inventory_router.get("/interno", response_model=list[InventoryCurrentRead])
async def inventory_interno(
    stock_status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    sort_by: str = Query(default="total_value"),
    sort_order: str = Query(default="desc"),
    limit: int = Query(default=2000, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[InventoryCurrentRead]:
    return await AssetService(db).get_inventory_current(
        is_saleable=False,
        stock_status=stock_status,
        search=search,
        category=category,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
    )

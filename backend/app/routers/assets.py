from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user_model import User
from app.schemas.assets_schema import (
    AdjustmentCreate,
    AssetAssignmentRead,
    AssetComponentCreate,
    AssetComponentDetailRead,
    AssetComponentHistoryRead,
    AssetCreate,
    AssetRead,
    AssetUpdate,
    AssignAssetPayload,
    DepreciationConfigCreate,
    DepreciationScheduleRead,
    InventoryCurrentRead,
    InventoryKpiSummaryRead,
    InventoryMovementRead,
    InventorySnapshotRead,
    PhysicalCountCreate,
    PhysicalCountLineRead,
    PhysicalCountLineUpdate,
    PhysicalCountRead,
    ProductCountLineRead,
    ProductCountLineUpdate,
    RemoveComponentRequest,
    RetireAssetPayload,
    WorkOrderCreate,
    WorkOrderRead,
    WorkOrderUpdate,
)
from app.services.assets_service import AssetService

router = APIRouter(prefix="/api/assets", tags=["assets"])


# ── Assets ───────────────────────────────────────────────────────────────────

@router.get("", response_model=list[AssetRead])
async def list_assets(
    status: str | None = Query(default=None),
    asset_type: str | None = Query(default=None),
    location: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AssetRead]:
    return await AssetService(db).list_assets(
        status=status, asset_type=asset_type, location=location,
        search=search, limit=limit, offset=offset
    )


@router.post("", response_model=AssetRead, status_code=status.HTTP_201_CREATED)
async def create_asset(
    data: AssetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetRead:
    return await AssetService(db).create_asset(data, current_user.id)


# ── Conteo Físico (debe ir ANTES de /{asset_id} para evitar captura por el path param) ──

@router.post("/counts", response_model=PhysicalCountRead, status_code=status.HTTP_201_CREATED)
async def create_physical_count(
    data: PhysicalCountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PhysicalCountRead:
    return await AssetService(db).create_physical_count(data, current_user.id)


@router.get("/counts", response_model=list[PhysicalCountRead])
async def list_physical_counts(
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[PhysicalCountRead]:
    return await AssetService(db).list_physical_counts(status=status, limit=limit, offset=offset)


@router.get("/counts/{count_id}/lines", response_model=list[PhysicalCountLineRead])
async def get_count_lines(
    count_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[PhysicalCountLineRead]:
    return await AssetService(db).get_physical_count_lines(count_id)


@router.patch("/counts/{count_id}/lines/{line_id}", response_model=PhysicalCountLineRead)
async def update_count_line(
    count_id: UUID,
    line_id: UUID,
    data: PhysicalCountLineUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PhysicalCountLineRead:
    try:
        return await AssetService(db).update_count_line(count_id, line_id, data, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/counts/{count_id}/product-lines", response_model=list[ProductCountLineRead])
async def get_product_count_lines(
    count_id: UUID,
    search: str | None = Query(default=None),
    is_saleable: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ProductCountLineRead]:
    return await AssetService(db).get_product_count_lines(count_id, search=search, is_saleable=is_saleable)


@router.patch("/counts/{count_id}/product-lines/{line_id}", response_model=ProductCountLineRead)
async def update_product_count_line(
    count_id: UUID,
    line_id: UUID,
    data: ProductCountLineUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProductCountLineRead:
    try:
        return await AssetService(db).update_product_count_line(count_id, line_id, data, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/counts/{count_id}/confirm", response_model=PhysicalCountRead)
async def confirm_physical_count(
    count_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PhysicalCountRead:
    try:
        return await AssetService(db).confirm_physical_count(count_id, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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


# ── Órdenes de Mantenimiento ─────────────────────────────────────────────────

@router.post(
    "/{asset_id}/work-orders",
    response_model=WorkOrderRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_work_order(
    asset_id: UUID,
    data: WorkOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkOrderRead:
    return await AssetService(db).create_work_order(asset_id, data, current_user.id)


@router.get("/{asset_id}/work-orders", response_model=list[WorkOrderRead])
async def list_work_orders(
    asset_id: UUID,
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[WorkOrderRead]:
    return await AssetService(db).list_work_orders(
        asset_id, status=status, limit=limit, offset=offset
    )


@router.patch("/{asset_id}/work-orders/{wo_id}", response_model=WorkOrderRead)
async def update_work_order(
    asset_id: UUID,
    wo_id: UUID,
    data: WorkOrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkOrderRead:
    try:
        return await AssetService(db).update_work_order(asset_id, wo_id, data, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ── Jerarquía ────────────────────────────────────────────────────────────────

@router.get("/{asset_id}/children", response_model=list[AssetRead])
async def get_children(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AssetRead]:
    return await AssetService(db).get_children(asset_id)


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


# ── Depreciación ─────────────────────────────────────────────────────────────

@router.get("/{asset_id}/depreciation", response_model=DepreciationScheduleRead)
async def get_depreciation(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DepreciationScheduleRead:
    return await AssetService(db).get_depreciation(asset_id)


@router.post("/{asset_id}/depreciation", response_model=DepreciationScheduleRead)
async def upsert_depreciation(
    asset_id: UUID,
    data: DepreciationConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DepreciationScheduleRead:
    return await AssetService(db).upsert_depreciation_config(asset_id, data, current_user.id)


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


@inventory_router.get("/movimientos", response_model=list[InventoryMovementRead])
async def list_movements(
    product_id: UUID | None = Query(default=None),
    movement_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[InventoryMovementRead]:
    return await AssetService(db).list_movements(
        product_id=product_id,
        movement_type=movement_type,
        search=search,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )


@inventory_router.post("/ajustes", response_model=InventoryMovementRead, status_code=201)
async def create_adjustment(
    data: AdjustmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryMovementRead:
    try:
        return await AssetService(db).create_adjustment(data, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

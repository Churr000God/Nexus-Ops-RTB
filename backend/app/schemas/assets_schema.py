from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ── Asset ────────────────────────────────────────────────────────────────────

class AssetCreate(BaseModel):
    asset_code: str
    asset_type: str
    name: str
    base_product_id: UUID | None = None
    serial_number: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    location: str | None = None
    assigned_user_id: UUID | None = None
    parent_asset_id: UUID | None = None
    status: str = "ACTIVE"
    purchase_date: date | None = None
    purchase_cost: float | None = None
    warranty_until: date | None = None
    notes: str | None = None


class AssetUpdate(BaseModel):
    asset_type: str | None = None
    name: str | None = None
    base_product_id: UUID | None = None
    serial_number: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    location: str | None = None
    assigned_user_id: UUID | None = None
    parent_asset_id: UUID | None = None
    status: str | None = None
    purchase_date: date | None = None
    purchase_cost: float | None = None
    warranty_until: date | None = None
    notes: str | None = None


class AssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_code: str
    asset_type: str
    name: str
    base_product_id: UUID | None
    serial_number: str | None
    manufacturer: str | None
    model: str | None
    location: str | None
    assigned_user_id: UUID | None
    parent_asset_id: UUID | None = None
    status: str
    purchase_date: date | None
    purchase_cost: float | None
    warranty_until: date | None
    notes: str | None
    retired_at: datetime | None = None
    retirement_reason: str | None = None
    salvage_value: float | None = None
    retired_by: UUID | None = None
    created_at: datetime
    updated_at: datetime


# ── AssetComponent ───────────────────────────────────────────────────────────

class AssetComponentCreate(BaseModel):
    product_id: UUID | None = None
    quantity: float = 1.0
    serial_number: str | None = None
    notes: str | None = None


class AssetComponentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_id: UUID
    product_id: UUID | None
    quantity: float
    serial_number: str | None
    installed_at: datetime
    installed_by: UUID | None
    notes: str | None


class AssetComponentDetailRead(BaseModel):
    """Componente enriquecido con datos del producto (desde v_asset_current_components)."""

    asset_component_id: UUID
    product_id: UUID | None
    component_sku: str | None
    component_name: str | None
    quantity: float
    serial_number: str | None
    installed_at: datetime
    installed_by_email: str | None
    notes: str | None


# ── AssetComponentHistory ────────────────────────────────────────────────────

class AssetComponentHistoryRead(BaseModel):
    """Fila del historial cronológico de un equipo (desde v_asset_repair_history)."""

    history_id: UUID
    occurred_at: datetime
    operation: str
    component_sku: str | None
    component_name: str | None
    quantity: float | None
    serial_number: str | None
    performed_by: str | None
    reason: str | None
    notes: str | None
    inventory_movement_id: UUID | None
    nc_id: UUID | None


# ── RemoveComponent ──────────────────────────────────────────────────────────

class RemoveComponentRequest(BaseModel):
    is_reusable: bool
    reason: str | None = None
    notes: str | None = None


# ── RetireAsset ──────────────────────────────────────────────────────────────

class RetireAssetPayload(BaseModel):
    retirement_reason: str | None = None
    salvage_value: float | None = None


# ── AssetAssignment ──────────────────────────────────────────────────────────

class AssignAssetPayload(BaseModel):
    user_id: UUID | None = None
    location: str | None = None
    notes: str | None = None


class AssetAssignmentRead(BaseModel):
    id: UUID
    asset_id: UUID
    user_id: UUID | None
    user_email: str | None
    user_name: str | None
    location: str | None
    assigned_at: datetime
    assigned_by_email: str | None
    notes: str | None


# ── PhysicalCount ────────────────────────────────────────────────────────────

class PhysicalCountCreate(BaseModel):
    count_date: date
    location_filter: str | None = None
    notes: str | None = None


class PhysicalCountLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    count_id: UUID
    asset_id: UUID
    asset_code: str
    asset_name: str
    expected_location: str | None
    scanned_location: str | None
    found: bool | None
    notes: str | None


class PhysicalCountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    count_date: date
    location_filter: str | None
    status: str
    notes: str | None
    created_by: UUID | None
    created_at: datetime
    confirmed_at: datetime | None
    confirmed_by: UUID | None
    total_lines: int = 0
    found_count: int = 0
    not_found_count: int = 0
    pending_count: int = 0


class PhysicalCountLineUpdate(BaseModel):
    found: bool | None = None
    scanned_location: str | None = None
    notes: str | None = None


# ── InventorySnapshot ────────────────────────────────────────────────────────

class InventorySnapshotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID | None
    snapshot_date: date
    quantity_on_hand: float | None
    avg_unit_cost: float | None
    total_value: float | None
    created_at: datetime


# ── KPI inventario (actualizado con vistas nuevas) ───────────────────────────

class InventoryCurrentRead(BaseModel):
    """Fila de v_inventory_current con stock teórico desde tabla inventario."""

    product_id: UUID
    sku: str | None
    name: str
    is_saleable: bool
    category: str | None
    quantity_on_hand: float
    theoretical_qty: float | None = None
    avg_unit_cost: float
    total_value: float
    theoretical_value: float | None = None
    min_stock: float | None
    stock_status: str


class InventoryKpiSummaryRead(BaseModel):
    """KPIs agregados para el header de la página de inventario."""

    total_productos: int
    valor_total_real: float
    valor_total_vendible: float
    valor_total_interno: float
    productos_out_of_stock: int
    productos_below_min: int
    productos_out_of_stock_vendible: int
    productos_below_min_vendible: int
    productos_out_of_stock_interno: int
    productos_below_min_interno: int
    total_assets: int
    assets_en_reparacion: int
    total_vendible: int
    total_interno: int
    con_stock_vendible: int
    sin_stock_vendible: int
    stock_negativo_vendible: int
    con_stock_interno: int
    sin_stock_interno: int
    stock_negativo_interno: int

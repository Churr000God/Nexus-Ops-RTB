from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ─────────────────────────────────────────────────────────────────────────────
# SAT catalogs
# ─────────────────────────────────────────────────────────────────────────────


class SATProductKeyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    description: str
    is_active: bool


class SATUnitKeyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    description: str
    is_active: bool


# ─────────────────────────────────────────────────────────────────────────────
# Brands
# ─────────────────────────────────────────────────────────────────────────────


class BrandRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    is_active: bool


class BrandCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str | None = None
    is_active: bool = True


# ─────────────────────────────────────────────────────────────────────────────
# Categories
# ─────────────────────────────────────────────────────────────────────────────


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    parent_id: UUID | None
    name: str
    slug: str | None
    description: str | None
    profit_margin_percent: Decimal | None
    is_active: bool


class CategoryTreeNode(CategoryRead):
    children: list[CategoryTreeNode] = []


class CategoryCreate(BaseModel):
    parent_id: UUID | None = None
    name: str = Field(..., min_length=1, max_length=120)
    slug: str | None = None
    description: str | None = None
    profit_margin_percent: Decimal | None = Field(
        default=None, ge=0, le=1000
    )
    is_active: bool = True


class CategoryUpdate(BaseModel):
    parent_id: UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = None
    description: str | None = None
    profit_margin_percent: Decimal | None = Field(default=None, ge=0, le=1000)
    is_active: bool | None = None


# ─────────────────────────────────────────────────────────────────────────────
# Product attributes (configurable products)
# ─────────────────────────────────────────────────────────────────────────────


class ProductAttributeOptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    attribute_id: UUID
    value: str
    extra_cost: Decimal


class ProductAttributeOptionCreate(BaseModel):
    value: str = Field(..., min_length=1)
    extra_cost: Decimal = Field(default=Decimal("0"), ge=0)


class ProductAttributeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    name: str
    data_type: str
    is_required: bool
    sort_order: int
    options: list[ProductAttributeOptionRead] = []


class ProductAttributeCreate(BaseModel):
    name: str = Field(..., min_length=1)
    data_type: str = Field(..., pattern="^(TEXT|NUMBER|BOOLEAN|OPTION)$")
    is_required: bool = False
    sort_order: int = 0
    options: list[ProductAttributeOptionCreate] = []


# ─────────────────────────────────────────────────────────────────────────────
# Product configurations
# ─────────────────────────────────────────────────────────────────────────────


class ProductConfigurationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    config_sku: str | None
    config_hash: str
    attributes: dict
    additional_cost: Decimal
    notes: str | None
    created_at: datetime


class ProductConfigurationCreate(BaseModel):
    config_sku: str | None = None
    attributes: dict = Field(..., min_length=1)
    notes: str | None = None


# ─────────────────────────────────────────────────────────────────────────────
# BOM
# ─────────────────────────────────────────────────────────────────────────────


class BOMItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    bom_id: UUID
    component_id: UUID
    component_sku: str | None = None
    component_name: str | None = None
    quantity: Decimal
    notes: str | None


class BOMItemCreate(BaseModel):
    component_id: UUID
    quantity: Decimal = Field(..., gt=0)
    notes: str | None = None


class BOMRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    version: int
    is_active: bool
    notes: str | None
    created_at: datetime
    items: list[BOMItemRead] = []


class BOMCreate(BaseModel):
    notes: str | None = None
    items: list[BOMItemCreate] = []


# ─────────────────────────────────────────────────────────────────────────────
# Products
# ─────────────────────────────────────────────────────────────────────────────


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sku: str | None
    internal_code: str | None
    name: str
    description: str | None
    brand_id: UUID | None
    brand: str | None
    category_id: UUID | None
    category: str | None
    sat_product_key_id: UUID | None
    sat_unit_id: UUID | None
    status: str | None
    sale_type: str | None = None
    package_size: Decimal | None
    warehouse_location: str | None = None
    image_url: str | None = None
    datasheet_url: str | None = None
    unit_price: Decimal | None = None
    unit_price_base: Decimal | None = None
    purchase_cost_parts: Decimal | None = None
    purchase_cost_ariba: Decimal | None = None
    is_saleable: bool = True
    is_configurable: bool
    is_assembled: bool
    pricing_strategy: str
    moving_avg_months: int
    current_avg_cost: Decimal | None
    current_avg_cost_currency: str
    current_avg_cost_updated_at: datetime | None
    suggested_price: Decimal | None = None
    is_active: bool | None = None
    min_stock: Decimal | None = None
    theoretical_outflow: Decimal | None = None
    real_outflow: Decimal | None = None
    demand_90_days: Decimal | None = None
    demand_180_days: Decimal | None = None
    total_accumulated_sales: Decimal | None = None
    last_outbound_date: date | None = None
    created_at: datetime
    updated_at: datetime


class ProductDetailRead(ProductRead):
    attributes: list[ProductAttributeRead] = []
    active_bom: BOMRead | None = None
    cost_history: list["ProductCostHistoryRead"] = []
    active_contract_count: int = 0


class ProductCreate(BaseModel):
    sku: str = Field(..., min_length=1, max_length=255)
    internal_code: str | None = None
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    brand_id: UUID | None = None
    category_id: UUID | None = None
    sat_product_key_id: UUID | None = None
    sat_unit_id: UUID | None = None
    status: str | None = None
    sale_type: str | None = None
    package_size: Decimal | None = None
    warehouse_location: str | None = None
    image_url: str | None = None
    datasheet_url: str | None = None
    unit_price: Decimal | None = None
    purchase_cost_parts: Decimal | None = None
    purchase_cost_ariba: Decimal | None = None
    is_saleable: bool = True
    is_configurable: bool = False
    is_assembled: bool = False
    pricing_strategy: str = Field(
        default="MOVING_AVG", pattern="^(MOVING_AVG|PASSTHROUGH)$"
    )
    moving_avg_months: int = Field(default=6, ge=1, le=60)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    brand_id: UUID | None = None
    category_id: UUID | None = None
    sat_product_key_id: UUID | None = None
    sat_unit_id: UUID | None = None
    status: str | None = None
    sale_type: str | None = None
    package_size: Decimal | None = None
    warehouse_location: str | None = None
    image_url: str | None = None
    datasheet_url: str | None = None
    unit_price: Decimal | None = None
    purchase_cost_parts: Decimal | None = None
    purchase_cost_ariba: Decimal | None = None
    is_saleable: bool | None = None
    is_configurable: bool | None = None
    is_assembled: bool | None = None
    pricing_strategy: str | None = Field(
        default=None, pattern="^(MOVING_AVG|PASSTHROUGH)$"
    )
    moving_avg_months: int | None = Field(default=None, ge=1, le=60)
    is_active: bool | None = None


# ─────────────────────────────────────────────────────────────────────────────
# Pricing function result
# ─────────────────────────────────────────────────────────────────────────────


class QuotePricingResult(BaseModel):
    suggested_unit_cost: Decimal | None
    suggested_unit_price: Decimal | None
    cost_basis: str
    contract_price_id: UUID | None
    pricing_source: str


# ─────────────────────────────────────────────────────────────────────────────
# Customer contract prices (Ariba)
# ─────────────────────────────────────────────────────────────────────────────


class CustomerContractPriceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    customer_id: UUID
    product_id: UUID
    contract_type: str
    fixed_sale_price: Decimal
    currency: str
    valid_from: date
    valid_to: date | None
    is_current: bool
    last_change_notice: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class CustomerContractPriceCreate(BaseModel):
    customer_id: UUID
    product_id: UUID
    contract_type: str = Field(
        default="ARIBA", pattern="^(ARIBA|CONTRACT_OTHER)$"
    )
    fixed_sale_price: Decimal = Field(..., ge=0)
    currency: str = Field(default="MXN", max_length=3)
    valid_from: date
    valid_to: date | None = None
    last_change_notice: str = Field(..., min_length=10)
    notes: str | None = None

    @field_validator("valid_to")
    @classmethod
    def valid_to_after_valid_from(
        cls, v: date | None, info: object
    ) -> date | None:
        if v is not None:
            valid_from = getattr(info, "data", {}).get("valid_from")
            if valid_from and v < valid_from:
                raise ValueError("valid_to debe ser posterior a valid_from")
        return v


# ─────────────────────────────────────────────────────────────────────────────
# Product cost history
# ─────────────────────────────────────────────────────────────────────────────


class ProductCostHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    previous_avg_cost: Decimal | None
    new_avg_cost: Decimal
    quantity_received: Decimal | None
    unit_cost_of_receipt: Decimal | None
    triggered_by: str
    source_id: UUID | None
    recorded_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Pagination wrapper
# ─────────────────────────────────────────────────────────────────────────────


class ProductListResponse(BaseModel):
    total: int
    items: list[ProductRead]

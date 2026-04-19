from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SaleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    sold_on: datetime | None = None
    customer_name: str | None = None
    status: str | None = None
    subtotal: float | None = None
    total: float | None = None
    purchase_cost: float | None = None
    gross_margin: float | None = None
    margin_percent: float | None = None
    year_month: str | None = None


class SalesByMonthResponse(BaseModel):
    year_month: str = Field(min_length=7, max_length=7)
    sale_count: int
    total_revenue: float
    total_gross_margin: float


class SalesByCustomerResponse(BaseModel):
    customer: str
    sale_count: int
    total_revenue: float
    average_ticket: float


class GrossMarginByProductResponse(BaseModel):
    product: str
    sku: str | None = None
    qty: float
    revenue: float
    cost: float
    gross_margin: float
    margin_percent: float | None = None


class ApprovedVsCancelledByMonthResponse(BaseModel):
    year_month: str = Field(min_length=7, max_length=7)
    approved_count: int
    cancelled_count: int


class DashboardOverviewResponse(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    sale_count: int
    total_revenue: float
    total_gross_margin: float
    approved_quotes: int
    cancelled_quotes: int

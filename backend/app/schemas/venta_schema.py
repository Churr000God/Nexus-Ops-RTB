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


class SalesSummaryResponse(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    total_sales: float
    pending_quotes: int
    average_margin_percent: float
    conversion_rate: float
    total_quotes: int
    approved_quotes: int
    cancelled_quotes: int
    expired_quotes: int
    review_quotes: int


class SalesProjectionByMonthResponse(BaseModel):
    year_month: str = Field(min_length=7, max_length=7)
    actual_sales: float
    projected_sales: float


class SalesByProductDistributionResponse(BaseModel):
    product: str
    revenue: float
    percentage: float


class QuoteStatusByMonthResponse(BaseModel):
    year_month: str = Field(min_length=7, max_length=7)
    approved_count: int
    cancelled_count: int
    expired_count: int
    review_count: int
    quoting_count: int
    rejected_count: int
    approved_amount: float
    cancelled_amount: float
    expired_amount: float
    review_amount: float
    quoting_amount: float
    rejected_amount: float


class RecentQuoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    created_on: datetime | None = None
    customer_name: str | None = None
    status: str | None = None
    total: float | None = None
    subtotal: float | None = None
    can_convert: bool = False


class SalesForecastByProductResponse(BaseModel):
    product: str
    sku: str | None = None
    category: str | None = None
    predicted_units: float

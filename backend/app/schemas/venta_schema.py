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
    category: str | None = None
    sale_count: int
    total_revenue: float
    average_ticket: float


class SalesByCustomerTypeResponse(BaseModel):
    tipo_cliente: str
    total_ventas: float
    porcentaje_ventas: float


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
    num_ventas: int
    subtotal: float
    total_con_iva: float
    margen_bruto: float
    costo_compra: float
    projected_sales: float


class SalesByProductDistributionResponse(BaseModel):
    product: str
    sku: str | None = None
    qty: float
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


class MissingDemandResponse(BaseModel):
    product: str
    sku: str | None = None
    category: str | None = None
    demanda_faltante: float
    valor_venta_pendiente: float
    costo_compra_estimado: float
    pareto_percent: float | None = None


class SalesForecastByProductResponse(BaseModel):
    product: str
    sku: str | None = None
    category: str | None = None
    predicted_units: float


class AtRiskCustomerResponse(BaseModel):
    customer_id: UUID | None = None
    external_id: str | None = None
    customer_name: str
    compras_ult_90: float
    compras_90_previos: float
    ultima_compra: date | None = None
    riesgo_abandono: str


class PaymentTrendResponse(BaseModel):
    customer_name: str
    promedio_dias_pago: float
    ultimo_pago: date | None = None
    riesgo_pago: str


class ProductsByCustomerTypeResponse(BaseModel):
    tipo_cliente: str
    cantidad_solicitada: float
    cantidad_empacada: float


class PendingPaymentCustomerResponse(BaseModel):
    customer_name: str
    tipo_cliente: str | None = None
    num_pedidos: int
    total_adeudado: float
    desde_fecha: date | None = None
    dias_sin_pagar: int | None = None


class QuarterlyGrowthByCustomerTypeResponse(BaseModel):
    tipo_cliente: str
    ventas_trim_actual: float
    ventas_trim_anio_pasado: float
    crecimiento_trimestral_pct: float | None


class MonthlyGrowthYoYByCustomerTypeResponse(BaseModel):
    tipo_cliente: str
    ventas_mes_actual: float
    ventas_mismo_mes_anio_pasado: float
    tasa_crecimiento_pct: float | None


class AvgSalesByCustomerTypeResponse(BaseModel):
    tipo_cliente: str
    numero_clientes: int
    venta_promedio_por_cliente: float

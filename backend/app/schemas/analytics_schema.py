"""Schemas Pydantic — Módulo de Reportes y Analytics (Módulo 15)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class _AnalyticsBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# CFDI
# ---------------------------------------------------------------------------

class CfdiEmittedRow(_AnalyticsBase):
    cfdi_id: int
    uuid: str | None
    cfdi_type: str
    series: str | None
    folio: int | None
    customer: str | None
    receiver_rfc: str | None
    receiver_legal_name: str | None
    cfdi_use_id: str | None
    payment_method_id: str | None
    payment_form_id: str | None
    issue_date: date | None
    timbre_date: datetime | None
    subtotal: Decimal | None
    discount: Decimal | None
    tax_amount: Decimal | None
    total: Decimal | None
    status: str
    cancelled_at: datetime | None
    cancellation_reason: str | None
    sat_cancellation_motive: str | None
    replaced_by_uuid: str | None
    replaces_uuid: str | None
    amount_paid_via_complementos: Decimal
    credit_note_amount: Decimal


class CfdiSummaryByPeriodRow(_AnalyticsBase):
    year: int
    month: int
    cfdi_type: str
    status: str
    num_cfdis: int
    subtotal: Decimal | None
    tax: Decimal | None
    total: Decimal | None


class PaymentUnappliedRow(_AnalyticsBase):
    payment_id: int
    payment_number: str | None
    payment_date: date | None
    customer: str | None
    amount: Decimal
    amount_applied: Decimal
    amount_unapplied: Decimal
    bank_reference: str | None
    notes: str | None


# ---------------------------------------------------------------------------
# Compras
# ---------------------------------------------------------------------------

class SupplierInvoicesAgingRow(_AnalyticsBase):
    invoice_id: int
    invoice_number: str
    supplier_code: str
    supplier: str
    invoice_type: str | None
    invoice_date: date | None
    payment_due_date: date | None
    total: Decimal | None
    payment_status: str | None
    is_credit: bool | None
    sat_payment_method_id: str | None
    aging_bucket: str
    days_overdue: int | None


class TopSupplierRow(_AnalyticsBase):
    supplier_id: int
    code: str
    business_name: str
    supplier_type: str | None
    num_pos: int
    total_purchased: Decimal | None
    avg_po_value: Decimal | None
    avg_payment_time_days: int | None
    last_po_date: date | None
    days_since_last_po: int | None


class SupplierPerformanceRow(_AnalyticsBase):
    supplier_id: int
    code: str
    business_name: str
    pos_completed: int
    avg_actual_lead_days: Decimal | None
    avg_estimated_lead_days: Decimal | None
    avg_delay_days: Decimal | None
    on_time: int
    on_time_pct: Decimal
    total_ncs: int


# ---------------------------------------------------------------------------
# Comercial
# ---------------------------------------------------------------------------

class SalesByPeriodRow(_AnalyticsBase):
    year: int
    quarter: int
    month: int
    num_orders: int
    subtotal: Decimal | None
    tax: Decimal | None
    total: Decimal | None
    cost: Decimal | None
    gross_margin: Decimal | None
    margin_pct: Decimal | None


class TopCustomerRow(_AnalyticsBase):
    customer_id: int
    code: str
    business_name: str
    locality: str | None
    num_orders: int
    total_revenue: Decimal | None
    total_cost: Decimal | None
    gross_margin: Decimal | None
    margin_pct: Decimal | None
    avg_order_value: Decimal | None
    last_order_date: date | None
    days_since_last_order: int | None


class QuoteConversionRow(_AnalyticsBase):
    year: int
    month: int
    total_quotes: int
    approved: int
    rejected: int
    cancelled: int
    expired: int
    still_open: int
    conversion_pct: Decimal
    total_quoted: Decimal | None
    total_won: Decimal | None


class SalesRepRow(_AnalyticsBase):
    user_id: UUID
    sales_rep: str
    quotes_created: int
    quotes_approved: int
    conversion_pct: Decimal
    revenue_generated: Decimal | None
    margin_generated: Decimal | None
    avg_order_value: Decimal | None


# ---------------------------------------------------------------------------
# Margen
# ---------------------------------------------------------------------------

class ProductMarginRow(_AnalyticsBase):
    product_id: UUID
    sku: str
    name: str
    category: str | None
    category_target_margin: Decimal | None
    times_sold: int
    units_sold: Decimal | None
    revenue: Decimal | None
    cost: Decimal | None
    gross_margin: Decimal | None
    actual_margin_pct: Decimal | None
    current_avg_cost: Decimal | None


class CustomerProfitabilityRow(_AnalyticsBase):
    customer_id: int
    code: str
    business_name: str
    num_orders: int
    revenue: Decimal | None
    cost: Decimal | None
    gross_margin: Decimal | None
    margin_pct: Decimal | None
    amount_collected: Decimal
    amount_outstanding: Decimal | None
    avg_days_to_pay: Decimal | None


class CategoryMarginRow(_AnalyticsBase):
    category_id: UUID
    category: str
    target_margin: Decimal | None
    items_sold: int | None
    revenue: Decimal | None
    cost: Decimal | None
    margin: Decimal | None
    actual_margin_pct: Decimal | None


# ---------------------------------------------------------------------------
# Financiero
# ---------------------------------------------------------------------------

class AccountsReceivableRow(_AnalyticsBase):
    customer_id: int
    code: str
    business_name: str
    billed: Decimal | None
    collected: Decimal
    outstanding: Decimal | None
    bucket_0_30: Decimal
    bucket_31_60: Decimal
    bucket_61_90: Decimal
    bucket_90_plus: Decimal


class AccountsPayableRow(_AnalyticsBase):
    supplier_id: int
    code: str
    business_name: str
    outstanding: Decimal | None
    bucket_current: Decimal | None
    bucket_overdue_30: Decimal | None
    bucket_overdue_60: Decimal | None
    bucket_overdue_60_plus: Decimal | None


class CashFlowRow(_AnalyticsBase):
    period: str
    period_date: date
    inflow: Decimal
    outflow: Decimal
    net: Decimal


class ExpensesByCategoryRow(_AnalyticsBase):
    year: int
    month: int
    category: str | None
    num_expenses: int
    subtotal: Decimal | None
    tax: Decimal | None
    total: Decimal | None
    deductible: Decimal | None
    non_deductible: Decimal | None


# ---------------------------------------------------------------------------
# Operación
# ---------------------------------------------------------------------------

class WarehouseKpis(_AnalyticsBase):
    active_skus_saleable: int
    skus_out_of_stock: int
    skus_below_min: int
    total_inventory_value: Decimal | None
    receipts_this_month: int
    issues_this_month: int
    active_orders: int
    orders_with_shortage: int
    orders_in_packing: int
    open_non_conformities: int


class NcBySupplierRow(_AnalyticsBase):
    supplier_code: str | None
    business_name: str | None
    total_ncs: int
    ncs_last_90d: int
    open_ncs: int
    total_quantity_affected: Decimal | None


class RouteEfficiencyRow(_AnalyticsBase):
    route_id: int
    route_number: str | None
    route_date: date | None
    driver: str | None
    total_stops: int
    completed_stops: int
    failed_stops: int
    deliveries: int
    pickups: int
    duration_hours: Decimal | None
    total_distance_km: Decimal | None
    completion_pct: Decimal


# ---------------------------------------------------------------------------
# Ejecutivo
# ---------------------------------------------------------------------------

class ExecutiveDashboard(_AnalyticsBase):
    revenue_mtd: Decimal
    margin_mtd: Decimal | None
    open_quotes: int
    open_quotes_value: Decimal
    total_ar: Decimal | None
    ar_overdue_60_plus: Decimal | None
    total_ap: Decimal | None
    inventory_value: Decimal | None
    skus_in_alert: int
    active_orders: int
    orders_with_shortage: int
    open_ncs: int
    cfdis_emitted_mtd: int
    cfdis_cancelled_mtd: int

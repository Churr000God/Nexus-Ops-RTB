"""Schemas Pydantic — Módulo Ventas y Logística."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Carriers
# ---------------------------------------------------------------------------

class CarrierCreate(BaseModel):
    code: str
    name: str
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None
    tracking_url_template: str | None = None
    is_internal: bool = False
    is_active: bool = True


class CarrierUpdate(BaseModel):
    name: str | None = None
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None
    tracking_url_template: str | None = None
    is_internal: bool | None = None
    is_active: bool | None = None


class CarrierResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    carrier_id: int
    code: str
    name: str
    contact_name: str | None
    phone: str | None
    email: str | None
    tracking_url_template: str | None
    is_internal: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Delivery Notes
# ---------------------------------------------------------------------------

class DeliveryNoteItemCreate(BaseModel):
    product_id: UUID | None = None
    sku: str | None = None
    description: str
    quantity: float = Field(default=1, gt=0)
    unit_price: float = Field(default=0, ge=0)
    discount_amount: float = Field(default=0, ge=0)
    tax_rate: float = Field(default=0.16, ge=0)
    notes: str | None = None
    sort_order: int = 0


class DeliveryNoteItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_id: int
    delivery_note_id: int
    product_id: UUID | None
    sku: str | None
    description: str
    quantity: float
    unit_price: float
    discount_amount: float
    tax_rate: float
    subtotal: float
    tax_amount: float
    total: float
    notes: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime


class DeliveryNoteCreate(BaseModel):
    customer_id: int
    shipping_address_id: int | None = None
    issue_date: date
    delivery_date: date | None = None
    customer_po_number: str | None = None
    customer_po_date: date | None = None
    notes: str | None = None
    items: list[DeliveryNoteItemCreate] = []


class DeliveryNoteUpdate(BaseModel):
    shipping_address_id: int | None = None
    delivery_date: date | None = None
    status: str | None = None
    customer_po_number: str | None = None
    customer_po_date: date | None = None
    notes: str | None = None
    cancellation_reason: str | None = None


class DeliveryNoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    delivery_note_id: int
    note_number: str
    customer_id: int
    shipping_address_id: int | None
    sales_rep_id: UUID | None
    issue_date: date
    delivery_date: date | None
    status: str
    customer_po_number: str | None
    customer_po_date: date | None
    subtotal: float
    tax_amount: float
    total: float
    notes: str | None
    cancelled_at: datetime | None
    cancellation_reason: str | None
    items: list[DeliveryNoteItemResponse] = []
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Quotes
# ---------------------------------------------------------------------------

class QuoteItemCreate(BaseModel):
    product_id: UUID | None = None
    delivery_note_item_id: int | None = None
    sku: str | None = None
    description: str
    quantity: float = Field(default=1, gt=0)
    unit_price: float = Field(default=0, ge=0)
    discount_pct: float = Field(default=0, ge=0, le=100)
    tax_rate: float = Field(default=0.16, ge=0)
    notes: str | None = None
    sort_order: int = 0


class QuoteItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    quote_item_id: int
    quote_id: int
    product_id: UUID | None
    delivery_note_item_id: int | None
    sku: str | None
    description: str
    quantity: float
    unit_price: float
    discount_pct: float
    tax_rate: float
    subtotal: float
    tax_amount: float
    total: float
    notes: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime


class QuoteCreate(BaseModel):
    customer_id: int
    issue_date: date
    expiry_date: date | None = None
    customer_po_number: str | None = None
    customer_po_date: date | None = None
    currency: str = "MXN"
    exchange_rate: float = 1.0
    payment_terms: str | None = None
    shipping_address_id: int | None = None
    notes: str | None = None
    internal_notes: str | None = None
    items: list[QuoteItemCreate] = []


class QuoteUpdate(BaseModel):
    expiry_date: date | None = None
    customer_po_number: str | None = None
    customer_po_date: date | None = None
    currency: str | None = None
    exchange_rate: float | None = None
    payment_terms: str | None = None
    shipping_address_id: int | None = None
    notes: str | None = None
    internal_notes: str | None = None


class QuoteApprove(BaseModel):
    notes: str | None = None


class QuoteReject(BaseModel):
    rejection_reason: str


class QuoteLinkDeliveryNotes(BaseModel):
    delivery_note_ids: list[int]
    notes: str | None = None


class QuoteStatusHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    history_id: int
    quote_id: int
    from_status: str | None
    to_status: str
    changed_by: UUID | None
    changed_at: datetime
    notes: str | None


class QuoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    quote_id: int
    quote_number: str
    customer_id: int
    sales_rep_id: UUID | None
    status: str
    issue_date: date
    expiry_date: date | None
    customer_po_number: str | None
    customer_po_date: date | None
    currency: str
    exchange_rate: float
    payment_terms: str | None
    shipping_address_id: int | None
    subtotal: float
    tax_amount: float
    total: float
    notes: str | None
    internal_notes: str | None
    approved_by: UUID | None
    approved_at: datetime | None
    rejected_by: UUID | None
    rejected_at: datetime | None
    rejection_reason: str | None
    items: list[QuoteItemResponse] = []
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

class OrderItemPackUpdate(BaseModel):
    quantity_packed: float = Field(ge=0)


class OrderUpdate(BaseModel):
    status: str | None = None
    packing_status: str | None = None
    packer_id: UUID | None = None
    requested_delivery_date: date | None = None
    shipping_address_id: int | None = None
    payment_terms: str | None = None
    notes: str | None = None
    internal_notes: str | None = None
    cancellation_reason: str | None = None


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    order_item_id: int
    order_id: int
    quote_item_id: int | None
    product_id: UUID | None
    sku: str | None
    description: str
    quantity_ordered: float
    quantity_packed: float
    quantity_shipped: float
    unit_price: float
    discount_pct: float
    tax_rate: float
    subtotal: float
    tax_amount: float
    total: float
    notes: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime


class OrderMilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    milestone_id: int
    order_id: int
    milestone_type: str
    occurred_at: datetime
    recorded_by: UUID | None
    notes: str | None


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    order_id: int
    order_number: str
    quote_id: int | None
    customer_id: int
    sales_rep_id: UUID | None
    packer_id: UUID | None
    status: str
    packing_status: str
    order_date: date
    requested_delivery_date: date | None
    delivery_date: date | None
    shipping_address_id: int | None
    currency: str
    exchange_rate: float
    payment_terms: str | None
    subtotal: float
    tax_amount: float
    total: float
    amount_paid: float
    notes: str | None
    internal_notes: str | None
    cancelled_at: datetime | None
    cancellation_reason: str | None
    items: list[OrderItemResponse] = []
    milestones: list[OrderMilestoneResponse] = []
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# CFDI
# ---------------------------------------------------------------------------

class CFDIItemCreate(BaseModel):
    order_item_id: int | None = None
    product_id: UUID | None = None
    quantity: float = Field(default=1, gt=0)
    unit_key: str | None = None
    product_key: str | None = None
    description: str
    unit_price: float = Field(default=0, ge=0)
    discount_amount: float = Field(default=0, ge=0)
    tax_rate: float = Field(default=0.16, ge=0)
    sort_order: int = 0


class CFDIItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cfdi_item_id: int
    cfdi_id: int
    order_item_id: int | None
    product_id: UUID | None
    quantity: float
    unit_key: str | None
    product_key: str | None
    description: str
    unit_price: float
    discount_amount: float
    tax_rate: float
    subtotal: float
    tax_amount: float
    total: float
    sort_order: int
    created_at: datetime


class CFDICreate(BaseModel):
    order_id: int | None = None
    customer_id: int
    cfdi_type: str = "I"
    series: str | None = None
    issue_date: date
    currency: str = "MXN"
    exchange_rate: float = 1.0
    payment_method: str | None = None
    payment_form: str | None = None
    cfdi_use: str | None = None
    items: list[CFDIItemCreate] = []


class CFDICancelRequest(BaseModel):
    sat_cancellation_motive: str = Field(pattern="^(01|02|03|04)$")
    cancellation_reason: str
    replaces_cfdi_id: int | None = None


class CFDIResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cfdi_id: int
    cfdi_number: str
    uuid: str | None
    cfdi_type: str
    series: str | None
    order_id: int | None
    customer_id: int
    sales_rep_id: UUID | None
    issue_date: date
    certification_date: datetime | None
    subtotal: float
    tax_amount: float
    total: float
    currency: str
    exchange_rate: float
    payment_method: str | None
    payment_form: str | None
    cfdi_use: str | None
    status: str
    replaces_cfdi_id: int | None
    replaced_by_cfdi_id: int | None
    sat_cancellation_motive: str | None
    cancelled_at: datetime | None
    cancellation_reason: str | None
    items: list[CFDIItemResponse] = []
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------

class PaymentCreate(BaseModel):
    customer_id: int
    payment_date: date
    payment_form: str
    currency: str = "MXN"
    exchange_rate: float = 1.0
    amount: float = Field(gt=0)
    bank_reference: str | None = None
    bank_account: str | None = None
    notes: str | None = None


class PaymentApplicationCreate(BaseModel):
    order_id: int | None = None
    cfdi_id: int | None = None
    amount_applied: float = Field(gt=0)
    notes: str | None = None


class PaymentApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    application_id: int
    payment_id: int
    order_id: int | None
    cfdi_id: int | None
    amount_applied: float
    applied_at: datetime
    applied_by: UUID | None
    notes: str | None


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    payment_id: int
    payment_number: str
    customer_id: int
    payment_date: date
    payment_form: str
    currency: str
    exchange_rate: float
    amount: float
    bank_reference: str | None
    bank_account: str | None
    notes: str | None
    status: str
    recorded_by: UUID | None
    applications: list[PaymentApplicationResponse] = []
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Shipments
# ---------------------------------------------------------------------------

class ShipmentItemCreate(BaseModel):
    order_item_id: int
    quantity: float = Field(gt=0)
    notes: str | None = None


class ShipmentItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    shipment_item_id: int
    shipment_id: int
    order_item_id: int
    quantity: float
    notes: str | None
    created_at: datetime


class TrackingEventCreate(BaseModel):
    event_date: datetime | None = None
    location: str | None = None
    status_code: str
    description: str | None = None


class TrackingEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: int
    shipment_id: int
    event_date: datetime
    location: str | None
    status_code: str
    description: str | None
    recorded_by: UUID | None
    is_automatic: bool
    created_at: datetime


class ShipmentCreate(BaseModel):
    order_id: int
    delivery_note_id: int | None = None
    customer_address_id: int | None = None
    carrier_id: int | None = None
    tracking_number: str | None = None
    shipping_date: date | None = None
    estimated_arrival: date | None = None
    shipping_cost: float | None = None
    items: list[ShipmentItemCreate] = []


class ShipmentUpdate(BaseModel):
    carrier_id: int | None = None
    tracking_number: str | None = None
    tracking_url: str | None = None
    status: str | None = None
    shipping_date: date | None = None
    estimated_arrival: date | None = None
    actual_arrival: date | None = None
    received_by_name: str | None = None
    delivery_evidence_url: str | None = None
    incident_notes: str | None = None
    shipping_cost: float | None = None


class ShipmentDeliverRequest(BaseModel):
    received_by_name: str
    actual_arrival: date | None = None
    delivery_evidence_url: str | None = None


class ShipmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    shipment_id: int
    shipment_number: str
    order_id: int
    delivery_note_id: int | None
    customer_address_id: int | None
    carrier_id: int | None
    tracking_number: str | None
    tracking_url: str | None
    status: str
    shipping_cost: float | None
    shipping_date: date | None
    estimated_arrival: date | None
    actual_arrival: date | None
    received_by_name: str | None
    delivery_evidence_url: str | None
    incident_notes: str | None
    items: list[ShipmentItemResponse] = []
    tracking_events: list[TrackingEventResponse] = []
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

class RouteStopCreate(BaseModel):
    stop_order: int = Field(ge=1)
    stop_type: str = Field(pattern="^(DELIVERY|PICKUP)$")
    customer_address_id: int | None = None
    shipment_id: int | None = None
    supplier_address_id: int | None = None
    purchase_order_id: UUID | None = None
    goods_receipt_id: UUID | None = None
    estimated_arrival: datetime | None = None
    notes: str | None = None


class RouteStopUpdate(BaseModel):
    stop_order: int | None = None
    shipment_id: int | None = None
    goods_receipt_id: UUID | None = None
    estimated_arrival: datetime | None = None
    actual_arrival: datetime | None = None
    actual_departure: datetime | None = None
    status: str | None = None
    failure_reason: str | None = None
    notes: str | None = None


class RouteStopResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    stop_id: int
    route_id: int
    stop_order: int
    stop_type: str
    customer_address_id: int | None
    shipment_id: int | None
    supplier_address_id: int | None
    purchase_order_id: UUID | None
    goods_receipt_id: UUID | None
    estimated_arrival: datetime | None
    actual_arrival: datetime | None
    actual_departure: datetime | None
    status: str
    failure_reason: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class RouteCreate(BaseModel):
    route_date: date
    driver_user_id: UUID | None = None
    vehicle_plate: str | None = None
    vehicle_label: str | None = None
    notes: str | None = None
    stops: list[RouteStopCreate] = []


class RouteUpdate(BaseModel):
    route_date: date | None = None
    driver_user_id: UUID | None = None
    vehicle_plate: str | None = None
    vehicle_label: str | None = None
    status: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    total_distance_km: float | None = None
    notes: str | None = None


class RouteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    route_id: int
    route_number: str
    route_date: date
    driver_user_id: UUID | None
    vehicle_plate: str | None
    vehicle_label: str | None
    status: str
    start_time: datetime | None
    end_time: datetime | None
    total_distance_km: float | None
    notes: str | None
    stops: list[RouteStopResponse] = []
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Vistas derivadas (read-only)
# ---------------------------------------------------------------------------

class OrderPackingProgressRow(BaseModel):
    order_id: int
    order_number: str
    customer: str
    status: str
    packing_status: str
    qty_ordered: float
    qty_packed: float
    packed_pct: float
    computed_status: str
    assigned_packer: str | None


class OrderPaymentStatusRow(BaseModel):
    order_id: int
    order_number: str
    customer_id: int
    customer: str
    total: float
    amount_paid: float
    amount_pending: float
    computed_payment_status: str
    first_payment_date: date | None
    last_payment_date: date | None
    num_payments: int


class IncompleteOrderRow(BaseModel):
    order_id: int
    order_number: str
    customer: str
    status: str
    order_date: date
    days_open: int
    qty_total: float
    qty_shipped: float
    qty_pending_to_ship: float
    completion_date: date | None


class ShipmentOverviewRow(BaseModel):
    shipment_id: int
    shipment_number: str
    status: str
    order_id: int
    order_number: str
    customer: str
    carrier_name: str | None
    tracking_number: str | None
    shipping_date: date | None
    estimated_arrival: date | None
    actual_arrival: date | None
    days_in_transit: int | None
    received_by_name: str | None
    incident_notes: str | None


class CFDICancellationRow(BaseModel):
    cfdi_id: int
    cfdi_number: str
    uuid: str | None
    customer_id: int
    customer: str
    total: float
    status: str
    cancelled_at: datetime | None
    cancellation_reason: str | None
    sat_cancellation_motive: str | None
    sat_cancellation_uuid_substitute: str | None
    substitute_cfdi_number: str | None
    substitute_uuid: str | None
    substitute_status: str | None

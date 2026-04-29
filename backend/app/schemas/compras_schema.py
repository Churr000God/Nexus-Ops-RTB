"""Schemas Pydantic — Módulo de Compras."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ---------------------------------------------------------------------------
# Catálogos SAT
# ---------------------------------------------------------------------------


class SatPaymentFormOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    form_id: str
    description: str
    is_active: bool


class SatPaymentMethodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    method_id: str
    description: str
    is_credit: bool
    is_active: bool


# ---------------------------------------------------------------------------
# Purchase Requests
# ---------------------------------------------------------------------------

ItemType = Literal["GOODS_RESALE", "GOODS_INTERNAL", "SERVICE"]
PRStatus = Literal["DRAFT", "APPROVED", "PARTIALLY_ORDERED", "ORDERED", "REJECTED", "CANCELLED"]


class PurchaseRequestItemIn(BaseModel):
    line_number: int = Field(ge=1)
    item_type: ItemType
    product_id: UUID | None = None
    service_description: str | None = None
    unit_of_measure: str | None = None
    quantity_requested: float = Field(gt=0)
    suggested_supplier_id: int | None = None
    quote_item_id: int | None = None
    in_package: bool = False
    exception_reason: str | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def check_product_or_service(self) -> PurchaseRequestItemIn:
        if self.item_type in ("GOODS_RESALE", "GOODS_INTERNAL") and not self.product_id:
            raise ValueError("product_id es obligatorio para items de tipo GOODS")
        if self.item_type == "SERVICE" and not self.service_description:
            raise ValueError("service_description es obligatorio para items de tipo SERVICE")
        return self


class PurchaseRequestIn(BaseModel):
    request_number: str
    request_date: date
    notes: str | None = None
    items: list[PurchaseRequestItemIn] = Field(min_length=1)


class PurchaseRequestStatusUpdate(BaseModel):
    status: PRStatus


class PurchaseRequestItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    request_item_id: int
    line_number: int
    item_type: str
    product_id: UUID | None
    service_description: str | None
    unit_of_measure: str | None
    quantity_requested: float
    quantity_ordered: float
    suggested_supplier_id: int | None
    quote_item_id: int | None
    in_package: bool
    exception_reason: str | None
    notes: str | None


class PurchaseRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    request_id: int
    request_number: str
    requested_by: UUID | None
    request_date: date
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
    items: list[PurchaseRequestItemOut] = []


class PurchaseRequestListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    request_id: int
    request_number: str
    requested_by: UUID | None
    request_date: date
    status: str
    notes: str | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Purchase Orders
# ---------------------------------------------------------------------------

POType = Literal["GOODS", "SERVICES", "MIXED"]
POStatus = Literal[
    "DRAFT", "SENT", "CONFIRMED", "PARTIAL_RECEIVED", "RECEIVED", "INVOICED", "PAID", "CANCELLED"
]


class PurchaseOrderItemIn(BaseModel):
    line_number: int = Field(ge=1)
    request_item_id: int | None = None
    item_type: ItemType
    product_id: UUID | None = None
    service_description: str | None = None
    unit_of_measure: str | None = None
    quantity_ordered: float = Field(gt=0)
    unit_cost: float | None = Field(default=None, ge=0)
    tax_pct: float = Field(default=16, ge=0)
    notes: str | None = None

    @model_validator(mode="after")
    def check_product_or_service(self) -> PurchaseOrderItemIn:
        if self.item_type in ("GOODS_RESALE", "GOODS_INTERNAL") and not self.product_id:
            raise ValueError("product_id es obligatorio para items de tipo GOODS")
        if self.item_type == "SERVICE" and not self.service_description:
            raise ValueError("service_description es obligatorio para items de tipo SERVICE")
        return self


class PurchaseOrderIn(BaseModel):
    po_number: str
    supplier_id: int
    po_type: POType = "GOODS"
    issue_date: date | None = None
    estimated_pickup_date: date | None = None
    currency: str = "MXN"
    exchange_rate: float = Field(default=1, gt=0)
    subtotal: float | None = None
    tax_amount: float | None = None
    shipping_amount: float | None = None
    total: float | None = None
    notes: str | None = None
    items: list[PurchaseOrderItemIn] = Field(min_length=1)


class PurchaseOrderStatusUpdate(BaseModel):
    status: POStatus


class PurchaseOrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    po_item_id: int
    line_number: int
    request_item_id: int | None
    item_type: str
    product_id: UUID | None
    service_description: str | None
    unit_of_measure: str | None
    quantity_ordered: float
    quantity_received: float
    unit_cost: float | None
    tax_pct: float
    subtotal: float | None
    notes: str | None


class PurchaseOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    po_id: int
    po_number: str
    supplier_id: int
    po_type: str
    status: str
    collection_status: str | None
    issue_date: date | None
    sent_date: date | None
    confirmation_date: date | None
    estimated_pickup_date: date | None
    pickup_date: date | None
    is_confirmed: bool
    is_email_sent: bool
    is_printed: bool
    currency: str
    exchange_rate: float
    subtotal: float | None
    tax_amount: float | None
    shipping_amount: float | None
    total: float | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    items: list[PurchaseOrderItemOut] = []


class PurchaseOrderListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    po_id: int
    po_number: str
    supplier_id: int
    po_type: str
    status: str
    issue_date: date | None
    estimated_pickup_date: date | None
    total: float | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Goods Receipts
# ---------------------------------------------------------------------------


class GoodsReceiptItemIn(BaseModel):
    po_item_id: int
    line_number: int = Field(ge=1)
    product_id: UUID | None = None
    quantity_requested: float = Field(gt=0)
    quantity_received: float = Field(ge=0)
    unit_cost: float | None = Field(default=None, ge=0)
    notes: str | None = None


class GoodsReceiptIn(BaseModel):
    receipt_number: str
    po_id: int
    supplier_id: int
    receipt_date: date
    physical_validation: bool = False
    notes: str | None = None
    items: list[GoodsReceiptItemIn] = Field(min_length=1)


class GoodsReceiptItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    receipt_item_id: int
    po_item_id: int
    line_number: int
    product_id: UUID | None
    quantity_requested: float
    quantity_received: float
    unit_cost: float | None
    notes: str | None


class GoodsReceiptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    receipt_id: int
    receipt_number: str
    po_id: int
    supplier_invoice_id: int | None
    supplier_id: int
    receipt_date: date
    physical_validation: bool
    validated_by: UUID | None
    validated_at: datetime | None
    delivery_pct: float | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    items: list[GoodsReceiptItemOut] = []


class GoodsReceiptListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    receipt_id: int
    receipt_number: str
    po_id: int
    supplier_id: int
    receipt_date: date
    physical_validation: bool
    delivery_pct: float | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Supplier Invoices
# ---------------------------------------------------------------------------

InvoiceType = Literal["GOODS", "SERVICES", "MIXED"]
InvoiceStatus = Literal["RECEIVED", "VALIDATED", "PAID", "CANCELLED"]
PaymentStatus = Literal["UNPAID", "PARTIAL", "PAID"]


class SupplierInvoiceItemIn(BaseModel):
    po_item_id: int | None = None
    receipt_item_id: int | None = None
    line_number: int = Field(ge=1)
    item_type: ItemType = "GOODS_RESALE"
    product_id: UUID | None = None
    concept_description: str | None = None
    unit_of_measure: str | None = None
    quantity: float = Field(gt=0)
    unit_cost: float | None = Field(default=None, ge=0)
    tax_pct: float = Field(default=16, ge=0)
    notes: str | None = None

    @model_validator(mode="after")
    def check_product_or_service(self) -> SupplierInvoiceItemIn:
        if self.item_type in ("GOODS_RESALE", "GOODS_INTERNAL") and not self.product_id:
            raise ValueError("product_id es obligatorio para items de tipo GOODS")
        if self.item_type == "SERVICE" and not self.concept_description:
            raise ValueError("concept_description es obligatorio para items de tipo SERVICE")
        return self


class SupplierInvoiceIn(BaseModel):
    invoice_number: str
    supplier_id: int
    po_id: int | None = None
    invoice_type: InvoiceType = "GOODS"
    invoice_date: date
    received_date: date | None = None
    sat_payment_form_id: str | None = None
    sat_payment_method_id: str | None = None
    uuid_sat: str | None = None
    subtotal: float | None = None
    tax_amount: float | None = None
    shipping_amount: float | None = None
    discount_amount: float | None = None
    total: float | None = None
    currency: str = "MXN"
    exchange_rate: float = Field(default=1, gt=0)
    notes: str | None = None
    items: list[SupplierInvoiceItemIn] = Field(min_length=1)


class SupplierInvoicePayUpdate(BaseModel):
    payment_date: date
    sat_payment_form_id: str | None = None


class SupplierInvoiceItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    invoice_item_id: int
    po_item_id: int | None
    receipt_item_id: int | None
    line_number: int
    item_type: str
    product_id: UUID | None
    concept_description: str | None
    unit_of_measure: str | None
    quantity: float
    unit_cost: float | None
    tax_pct: float
    subtotal: float | None
    notes: str | None


class SupplierInvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    invoice_id: int
    invoice_number: str
    supplier_id: int
    po_id: int | None
    invoice_type: str
    invoice_date: date
    received_date: date | None
    status: str
    payment_status: str
    payment_date: date | None
    sat_payment_form_id: str | None
    sat_payment_method_id: str | None
    is_credit: bool | None
    uuid_sat: str | None
    subtotal: float | None
    tax_amount: float | None
    shipping_amount: float | None
    discount_amount: float | None
    total: float | None
    currency: str
    exchange_rate: float
    notes: str | None
    created_at: datetime
    updated_at: datetime
    items: list[SupplierInvoiceItemOut] = []


class SupplierInvoiceListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    invoice_id: int
    invoice_number: str
    supplier_id: int
    po_id: int | None
    invoice_type: str
    invoice_date: date
    status: str
    payment_status: str
    is_credit: bool | None
    total: float | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Operating Expenses (gastos operativos extendidos con SAT)
# ---------------------------------------------------------------------------


class OperatingExpenseIn(BaseModel):
    concept: str
    category: str
    expense_date: date
    subtotal: float = Field(gt=0)
    supplier_id: str | None = None  # UUID string de proveedores legacy
    supplier_name: str | None = None
    supplier_rfc: str | None = None
    invoice_folio: str | None = None
    uuid_sat: str | None = None
    expense_number: str | None = None
    is_deductible: bool = False
    payment_method: str | None = None
    sat_payment_form_id: str | None = None
    sat_payment_method_id: str | None = None
    status: str = "Pendiente"
    notes: str | None = None


class OperatingExpenseUpdate(BaseModel):
    concept: str | None = None
    category: str | None = None
    expense_date: date | None = None
    subtotal: float | None = Field(default=None, gt=0)
    is_deductible: bool | None = None
    payment_method: str | None = None
    sat_payment_form_id: str | None = None
    sat_payment_method_id: str | None = None
    status: str | None = None
    notes: str | None = None
    uuid_sat: str | None = None


class OperatingExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: UUID
    concept: str
    category: str | None = None
    expense_date: date | None = None
    subtotal: float | None = None
    iva: float | None = None
    total: float | None = None
    supplier_id: UUID | None = None
    supplier_name: str | None = None
    supplier_rfc: str | None = None
    invoice_folio: str | None = None
    uuid_sat: str | None = None
    expense_number: str | None = None
    is_deductible: bool | None = None
    payment_method: str | None = None
    sat_payment_form_id: str | None = None
    sat_payment_method_id: str | None = None
    status: str | None = None
    notes: str | None = None
    created_at: datetime

    @classmethod
    def model_validate(cls, obj, **kwargs):
        instance = super().model_validate(obj, **kwargs)
        if instance.expense_date is None and hasattr(obj, "spent_on"):
            instance.expense_date = obj.spent_on
        return instance

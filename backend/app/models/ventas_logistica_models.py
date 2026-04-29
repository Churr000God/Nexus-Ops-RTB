"""Modelos SQLAlchemy — Módulo Ventas y Logística.

Cubre el ciclo completo:
  NR (delivery_notes) → cotización (quotes) → pedido (orders) →
  empacado → envío (shipments) / ruta (routes) → CFDI → cobro (payments)
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


# ---------------------------------------------------------------------------
# Carriers — catálogo de fleteras
# ---------------------------------------------------------------------------

class Carrier(Base):
    __tablename__ = "carriers"

    carrier_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    contact_name: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text)
    tracking_url_template: Mapped[str | None] = mapped_column(Text)
    is_internal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    shipments: Mapped[list["Shipment"]] = relationship(back_populates="carrier")


# ---------------------------------------------------------------------------
# Delivery Notes — notas de remisión informales
# ---------------------------------------------------------------------------

class DeliveryNote(Base):
    __tablename__ = "delivery_notes"

    delivery_note_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    note_number: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    customer_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("customers.customer_id"), nullable=False)
    shipping_address_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("customer_addresses.address_id"))
    sales_rep_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    delivery_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="DRAFT")
    customer_po_number: Mapped[str | None] = mapped_column(Text)
    customer_po_date: Mapped[date | None] = mapped_column(Date)
    subtotal: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    total: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancellation_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    items: Mapped[list["DeliveryNoteItem"]] = relationship(back_populates="delivery_note", cascade="all, delete-orphan")
    quote_links: Mapped[list["QuoteDeliveryNote"]] = relationship(back_populates="delivery_note")


class DeliveryNoteItem(Base):
    __tablename__ = "delivery_note_items"

    item_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    delivery_note_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("delivery_notes.delivery_note_id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("productos.id", ondelete="SET NULL"))
    sku: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    discount_amount: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    tax_rate: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=0.16)
    subtotal: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    total: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    delivery_note: Mapped["DeliveryNote"] = relationship(back_populates="items")


# ---------------------------------------------------------------------------
# Quotes — cotizaciones formales
# ---------------------------------------------------------------------------

class SalesQuote(Base):
    __tablename__ = "quotes"

    quote_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    quote_number: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    customer_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("customers.customer_id"), nullable=False)
    sales_rep_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    customer_po_number: Mapped[str | None] = mapped_column(Text)
    customer_po_date: Mapped[date | None] = mapped_column(Date)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="MXN")
    exchange_rate: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False, default=1)
    payment_terms: Mapped[str | None] = mapped_column(Text)
    shipping_address_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("customer_addresses.address_id"))
    subtotal: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    total: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    internal_notes: Mapped[str | None] = mapped_column(Text)
    approved_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejected_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    items: Mapped[list["SalesQuoteItem"]] = relationship(back_populates="quote", cascade="all, delete-orphan")
    status_history: Mapped[list["QuoteStatusHistory"]] = relationship(back_populates="quote", cascade="all, delete-orphan")
    delivery_note_links: Mapped[list["QuoteDeliveryNote"]] = relationship(back_populates="quote", cascade="all, delete-orphan")
    order: Mapped["Order | None"] = relationship(back_populates="quote", uselist=False)


class SalesQuoteItem(Base):
    __tablename__ = "quote_items"

    quote_item_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    quote_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("quotes.quote_id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("productos.id", ondelete="SET NULL"))
    delivery_note_item_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("delivery_note_items.item_id", ondelete="SET NULL"))
    sku: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    discount_pct: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=0)
    tax_rate: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=0.16)
    subtotal: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    total: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    quote: Mapped["SalesQuote"] = relationship(back_populates="items")


class QuoteStatusHistory(Base):
    __tablename__ = "quote_status_history"

    history_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    quote_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("quotes.quote_id", ondelete="CASCADE"), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    notes: Mapped[str | None] = mapped_column(Text)

    quote: Mapped["SalesQuote"] = relationship(back_populates="status_history")


class QuoteDeliveryNote(Base):
    __tablename__ = "quote_delivery_notes"
    __table_args__ = (UniqueConstraint("quote_id", "delivery_note_id"),)

    quote_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("quotes.quote_id", ondelete="CASCADE"), primary_key=True)
    delivery_note_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("delivery_notes.delivery_note_id"), primary_key=True)
    associated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    associated_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(Text)

    quote: Mapped["SalesQuote"] = relationship(back_populates="delivery_note_links")
    delivery_note: Mapped["DeliveryNote"] = relationship(back_populates="quote_links")


# ---------------------------------------------------------------------------
# Orders — pedidos formales
# ---------------------------------------------------------------------------

class Order(Base):
    __tablename__ = "orders"

    order_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    order_number: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    quote_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("quotes.quote_id"))
    customer_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("customers.customer_id"), nullable=False)
    sales_rep_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    packer_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="CREATED")
    packing_status: Mapped[str] = mapped_column(String(20), nullable=False, default="NOT_STARTED")
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    requested_delivery_date: Mapped[date | None] = mapped_column(Date)
    delivery_date: Mapped[date | None] = mapped_column(Date)
    shipping_address_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("customer_addresses.address_id"))
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="MXN")
    exchange_rate: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False, default=1)
    payment_terms: Mapped[str | None] = mapped_column(Text)
    subtotal: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    total: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    amount_paid: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    internal_notes: Mapped[str | None] = mapped_column(Text)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancellation_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    quote: Mapped["SalesQuote | None"] = relationship(back_populates="order")
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    milestones: Mapped[list["OrderMilestone"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    shipments: Mapped[list["Shipment"]] = relationship(back_populates="order")
    cfdis: Mapped[list["CFDI"]] = relationship(back_populates="order")
    payment_applications: Mapped[list["PaymentApplication"]] = relationship(back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    order_item_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    order_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False)
    quote_item_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("quote_items.quote_item_id", ondelete="SET NULL"))
    product_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("productos.id", ondelete="SET NULL"))
    sku: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity_ordered: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    quantity_packed: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    quantity_shipped: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    unit_price: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    discount_pct: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=0)
    tax_rate: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=0.16)
    subtotal: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    total: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    order: Mapped["Order"] = relationship(back_populates="items")
    shipment_items: Mapped[list["ShipmentItem"]] = relationship(back_populates="order_item")
    cfdi_items: Mapped[list["CFDIItem"]] = relationship(back_populates="order_item")


class OrderMilestone(Base):
    __tablename__ = "order_milestones"

    milestone_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    order_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False)
    milestone_type: Mapped[str] = mapped_column(String(20), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    recorded_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(Text)

    order: Mapped["Order"] = relationship(back_populates="milestones")


# ---------------------------------------------------------------------------
# CFDI — comprobantes fiscales
# ---------------------------------------------------------------------------

class CFDI(Base):
    __tablename__ = "cfdi"

    cfdi_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    cfdi_number: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    uuid: Mapped[str | None] = mapped_column(Text, unique=True)
    cfdi_type: Mapped[str] = mapped_column(String(1), nullable=False, default="I")
    series: Mapped[str | None] = mapped_column(Text)
    order_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("orders.order_id"))
    customer_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("customers.customer_id"), nullable=False)
    sales_rep_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    certification_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    subtotal: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    total: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="MXN")
    exchange_rate: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False, default=1)
    payment_method: Mapped[str | None] = mapped_column(String(3))
    payment_form: Mapped[str | None] = mapped_column(Text)
    cfdi_use: Mapped[str | None] = mapped_column(Text, ForeignKey("sat_cfdi_uses.use_id"))
    status: Mapped[str] = mapped_column(String(15), nullable=False, default="DRAFT")
    pac_response: Mapped[dict | None] = mapped_column(JSONB)
    replaces_cfdi_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("cfdi.cfdi_id"))
    replaced_by_cfdi_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("cfdi.cfdi_id"))
    sat_cancellation_motive: Mapped[str | None] = mapped_column(String(2))
    sat_cancellation_uuid_substitute: Mapped[str | None] = mapped_column(Text)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancellation_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    order: Mapped["Order | None"] = relationship(back_populates="cfdis")
    items: Mapped[list["CFDIItem"]] = relationship(back_populates="cfdi", cascade="all, delete-orphan")
    credit_notes: Mapped[list["CFDICreditNote"]] = relationship(foreign_keys="CFDICreditNote.cfdi_id", back_populates="cfdi", cascade="all, delete-orphan")
    payment_supplements: Mapped[list["CFDIPayment"]] = relationship(back_populates="cfdi", cascade="all, delete-orphan")
    payment_applications: Mapped[list["PaymentApplication"]] = relationship(back_populates="cfdi")


class CFDIItem(Base):
    __tablename__ = "cfdi_items"

    cfdi_item_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    cfdi_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("cfdi.cfdi_id", ondelete="CASCADE"), nullable=False)
    order_item_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("order_items.order_item_id", ondelete="SET NULL"))
    product_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("productos.id", ondelete="SET NULL"))
    quantity: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=1)
    unit_key: Mapped[str | None] = mapped_column(Text)
    product_key: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    discount_amount: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    tax_rate: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=0.16)
    subtotal: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    total: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    cfdi: Mapped["CFDI"] = relationship(back_populates="items")
    order_item: Mapped["OrderItem | None"] = relationship(back_populates="cfdi_items")


class CFDICreditNote(Base):
    __tablename__ = "cfdi_credit_notes"

    credit_note_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    cfdi_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("cfdi.cfdi_id", ondelete="CASCADE"), nullable=False)
    original_cfdi_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("cfdi.cfdi_id"), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    issued_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(Text)

    cfdi: Mapped["CFDI"] = relationship(foreign_keys=[cfdi_id], back_populates="credit_notes")


class CFDIPayment(Base):
    __tablename__ = "cfdi_payments"

    cfdi_payment_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    cfdi_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("cfdi.cfdi_id", ondelete="CASCADE"), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_form: Mapped[str] = mapped_column(Text, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="MXN")
    exchange_rate: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False, default=1)
    amount: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    partial_number: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    previous_balance: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    amount_paid: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    remaining_balance: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    bank_reference: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    cfdi: Mapped["CFDI"] = relationship(back_populates="payment_supplements")


# ---------------------------------------------------------------------------
# Payments — cobros y aplicaciones
# ---------------------------------------------------------------------------

class Payment(Base):
    __tablename__ = "payments"

    payment_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    payment_number: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    customer_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("customers.customer_id"), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_form: Mapped[str] = mapped_column(Text, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="MXN")
    exchange_rate: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False, default=1)
    amount: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    bank_reference: Mapped[str | None] = mapped_column(Text)
    bank_account: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    recorded_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    applications: Mapped[list["PaymentApplication"]] = relationship(back_populates="payment", cascade="all, delete-orphan")


class PaymentApplication(Base):
    __tablename__ = "payment_applications"

    application_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    payment_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("payments.payment_id", ondelete="CASCADE"), nullable=False)
    order_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("orders.order_id"))
    cfdi_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("cfdi.cfdi_id"))
    amount_applied: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    applied_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(Text)

    payment: Mapped["Payment"] = relationship(back_populates="applications")
    order: Mapped["Order | None"] = relationship(back_populates="payment_applications")
    cfdi: Mapped["CFDI | None"] = relationship(back_populates="payment_applications")


# ---------------------------------------------------------------------------
# Shipments — envíos físicos
# ---------------------------------------------------------------------------

class Shipment(Base):
    __tablename__ = "shipments"

    shipment_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    shipment_number: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    order_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("orders.order_id"), nullable=False)
    delivery_note_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("delivery_notes.delivery_note_id"))
    customer_address_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("customer_addresses.address_id"))
    carrier_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("carriers.carrier_id"))
    tracking_number: Mapped[str | None] = mapped_column(Text)
    tracking_url: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(15), nullable=False, default="PREPARING")
    shipping_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    shipping_date: Mapped[date | None] = mapped_column(Date)
    estimated_arrival: Mapped[date | None] = mapped_column(Date)
    actual_arrival: Mapped[date | None] = mapped_column(Date)
    received_by_name: Mapped[str | None] = mapped_column(Text)
    delivery_evidence_url: Mapped[str | None] = mapped_column(Text)
    incident_notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    order: Mapped["Order"] = relationship(back_populates="shipments")
    carrier: Mapped["Carrier | None"] = relationship(back_populates="shipments")
    items: Mapped[list["ShipmentItem"]] = relationship(back_populates="shipment", cascade="all, delete-orphan")
    tracking_events: Mapped[list["ShipmentTrackingEvent"]] = relationship(back_populates="shipment", cascade="all, delete-orphan")
    route_stop: Mapped["RouteStop | None"] = relationship(back_populates="shipment", uselist=False)


class ShipmentItem(Base):
    __tablename__ = "shipment_items"

    shipment_item_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    shipment_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("shipments.shipment_id", ondelete="CASCADE"), nullable=False)
    order_item_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("order_items.order_item_id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    shipment: Mapped["Shipment"] = relationship(back_populates="items")
    order_item: Mapped["OrderItem"] = relationship(back_populates="shipment_items")


class ShipmentTrackingEvent(Base):
    __tablename__ = "shipment_tracking_events"

    event_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    shipment_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("shipments.shipment_id", ondelete="CASCADE"), nullable=False)
    event_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    location: Mapped[str | None] = mapped_column(Text)
    status_code: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    is_automatic: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    shipment: Mapped["Shipment"] = relationship(back_populates="tracking_events")


# ---------------------------------------------------------------------------
# Routes — rutas del día
# ---------------------------------------------------------------------------

class Route(Base):
    __tablename__ = "routes"

    route_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    route_number: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    route_date: Mapped[date] = mapped_column(Date, nullable=False)
    driver_user_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    vehicle_plate: Mapped[str | None] = mapped_column(Text)
    vehicle_label: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(15), nullable=False, default="PLANNING")
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    total_distance_km: Mapped[float | None] = mapped_column(Numeric(8, 2))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    stops: Mapped[list["RouteStop"]] = relationship(back_populates="route", cascade="all, delete-orphan", order_by="RouteStop.stop_order")


class RouteStop(Base):
    __tablename__ = "route_stops"
    __table_args__ = (UniqueConstraint("route_id", "stop_order"),)

    stop_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    route_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("routes.route_id", ondelete="CASCADE"), nullable=False)
    stop_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    stop_type: Mapped[str] = mapped_column(String(10), nullable=False)
    customer_address_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("customer_addresses.address_id"))
    shipment_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("shipments.shipment_id"))
    supplier_address_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("supplier_addresses.address_id"))
    purchase_order_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("pedidos_proveedor.id"))
    goods_receipt_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("entradas_mercancia.id"))
    estimated_arrival: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_arrival: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_departure: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(15), nullable=False, default="PENDING")
    failure_reason: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    route: Mapped["Route"] = relationship(back_populates="stops")
    shipment: Mapped["Shipment | None"] = relationship(back_populates="route_stop")

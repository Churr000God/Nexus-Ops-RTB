"""Modelos SQLAlchemy — Módulo de Compras.

Cubre el ciclo completo de adquisiciones:
    purchase_requests → purchase_orders → goods_receipts
    → supplier_invoices → payments

Los gastos operativos (operating_expenses) se extienden sobre
la tabla legada gastos_operativos con campos SAT adicionales.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Numeric,
    SmallInteger,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


# ---------------------------------------------------------------------------
# Catálogos SAT
# ---------------------------------------------------------------------------


class SatPaymentForm(Base):
    """Catálogo SAT c_FormaPago (efectivo, transferencia, tarjeta…)."""

    __tablename__ = "sat_payment_forms"

    form_id: Mapped[str] = mapped_column(primary_key=True)
    description: Mapped[str]
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    supplier_invoices: Mapped[list[SupplierInvoice]] = relationship(
        back_populates="payment_form"
    )


class SatPaymentMethod(Base):
    """Catálogo SAT c_MetodoPago: PUE (contado) | PPD (crédito)."""

    __tablename__ = "sat_payment_methods"

    method_id: Mapped[str] = mapped_column(primary_key=True)
    description: Mapped[str]
    is_credit: Mapped[bool] = mapped_column(
        Boolean,
        Computed("method_id = 'PPD'", persisted=True),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    supplier_invoices: Mapped[list[SupplierInvoice]] = relationship(
        back_populates="payment_method"
    )


# ---------------------------------------------------------------------------
# Solicitudes de Material (Purchase Requests)
# ---------------------------------------------------------------------------


class PurchaseRequest(Base):
    """Cabecera de solicitud de material.

    Ciclo de vida: DRAFT → APPROVED → PARTIALLY_ORDERED / ORDERED
    """

    __tablename__ = "purchase_requests"

    request_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    request_number: Mapped[str] = mapped_column(nullable=False, unique=True)
    requested_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    request_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(nullable=False, default="DRAFT")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    items: Mapped[list[PurchaseRequestItem]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )


class PurchaseRequestItem(Base):
    """Partida de solicitud de material.

    item_type = GOODS_RESALE | GOODS_INTERNAL → product_id obligatorio
    item_type = SERVICE                        → service_description obligatorio
    """

    __tablename__ = "purchase_request_items"
    __table_args__ = (
        CheckConstraint(
            "(item_type IN ('GOODS_RESALE','GOODS_INTERNAL') AND product_id IS NOT NULL)"
            " OR (item_type = 'SERVICE' AND service_description IS NOT NULL)",
            name="chk_pri_product_or_service",
        ),
        UniqueConstraint("request_id", "line_number", name="uq_pri_request_line"),
    )

    request_item_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    request_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("purchase_requests.request_id", ondelete="CASCADE"), nullable=False, index=True
    )
    line_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    item_type: Mapped[str] = mapped_column(nullable=False)
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("productos.id", ondelete="SET NULL"), index=True
    )
    service_description: Mapped[str | None] = mapped_column(Text)
    unit_of_measure: Mapped[str | None]
    quantity_requested: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    quantity_ordered: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    suggested_supplier_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("suppliers.supplier_id", ondelete="SET NULL")
    )
    quote_item_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("quote_items.quote_item_id", ondelete="SET NULL")
    )
    in_package: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    exception_reason: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    request: Mapped[PurchaseRequest] = relationship(back_populates="items")
    purchase_order_items: Mapped[list[PurchaseOrderItem]] = relationship(
        back_populates="request_item"
    )


# ---------------------------------------------------------------------------
# Órdenes de Compra (Purchase Orders)
# ---------------------------------------------------------------------------


class PurchaseOrder(Base):
    """Cabecera de orden de compra a proveedor.

    po_type: GOODS | SERVICES | MIXED
    Flujo: DRAFT → SENT → CONFIRMED → PARTIAL_RECEIVED → RECEIVED → INVOICED → PAID
    """

    __tablename__ = "purchase_orders"

    po_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    po_number: Mapped[str] = mapped_column(nullable=False, unique=True)
    supplier_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("suppliers.supplier_id", ondelete="RESTRICT"), nullable=False, index=True
    )
    po_type: Mapped[str] = mapped_column(nullable=False, default="GOODS")
    status: Mapped[str] = mapped_column(nullable=False, default="DRAFT", index=True)
    collection_status: Mapped[str | None]
    issue_date: Mapped[date | None] = mapped_column(Date, index=True)
    sent_date: Mapped[date | None] = mapped_column(Date)
    confirmation_date: Mapped[date | None] = mapped_column(Date)
    estimated_pickup_date: Mapped[date | None] = mapped_column(Date)
    pickup_date: Mapped[date | None] = mapped_column(Date)
    is_confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_email_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_printed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    follow_up_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    currency: Mapped[str] = mapped_column(nullable=False, default="MXN")
    exchange_rate: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False, default=1)
    subtotal: Mapped[float | None] = mapped_column(Numeric(14, 4))
    tax_amount: Mapped[float | None] = mapped_column(Numeric(14, 4))
    shipping_amount: Mapped[float | None] = mapped_column(Numeric(14, 4))
    total: Mapped[float | None] = mapped_column(Numeric(14, 4))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    items: Mapped[list[PurchaseOrderItem]] = relationship(
        back_populates="purchase_order", cascade="all, delete-orphan"
    )
    goods_receipts: Mapped[list[ComprasGoodsReceipt]] = relationship(back_populates="purchase_order")
    supplier_invoices: Mapped[list[SupplierInvoice]] = relationship(back_populates="purchase_order")


class PurchaseOrderItem(Base):
    """Partida de orden de compra."""

    __tablename__ = "purchase_order_items"
    __table_args__ = (
        CheckConstraint(
            "(item_type IN ('GOODS_RESALE','GOODS_INTERNAL') AND product_id IS NOT NULL)"
            " OR (item_type = 'SERVICE' AND service_description IS NOT NULL)",
            name="chk_poi_product_or_service",
        ),
        UniqueConstraint("po_id", "line_number", name="uq_poi_po_line"),
    )

    po_item_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    po_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("purchase_orders.po_id", ondelete="CASCADE"), nullable=False, index=True
    )
    line_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    request_item_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("purchase_request_items.request_item_id", ondelete="SET NULL"),
        index=True,
    )
    item_type: Mapped[str] = mapped_column(nullable=False)
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("productos.id", ondelete="SET NULL"), index=True
    )
    service_description: Mapped[str | None] = mapped_column(Text)
    unit_of_measure: Mapped[str | None]
    quantity_ordered: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    quantity_received: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    unit_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    tax_pct: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=16)
    subtotal: Mapped[float | None] = mapped_column(
        Numeric(14, 4),
        Computed(
            "CASE WHEN unit_cost IS NULL OR quantity_ordered IS NULL THEN NULL"
            " ELSE quantity_ordered * unit_cost END",
            persisted=True,
        ),
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    purchase_order: Mapped[PurchaseOrder] = relationship(back_populates="items")
    request_item: Mapped[PurchaseRequestItem | None] = relationship(
        back_populates="purchase_order_items"
    )
    goods_receipt_items: Mapped[list[ComprasGoodsReceiptItem]] = relationship(
        back_populates="po_item"
    )
    supplier_invoice_items: Mapped[list[SupplierInvoiceItem]] = relationship(
        back_populates="po_item"
    )


# ---------------------------------------------------------------------------
# Recepciones de Mercancía (Goods Receipts)
# ---------------------------------------------------------------------------


class ComprasGoodsReceipt(Base):
    """Cabecera de recepción de mercancía.

    po_id es NOT NULL — toda entrada de bienes requiere una PO.
    """

    __tablename__ = "goods_receipts"

    receipt_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    receipt_number: Mapped[str] = mapped_column(nullable=False, unique=True)
    po_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("purchase_orders.po_id", ondelete="RESTRICT"), nullable=False, index=True
    )
    supplier_invoice_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("supplier_invoices.invoice_id", ondelete="SET NULL"), index=True
    )
    supplier_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("suppliers.supplier_id", ondelete="RESTRICT"), nullable=False, index=True
    )
    receipt_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    physical_validation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    validated_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivery_pct: Mapped[float | None] = mapped_column(Numeric(6, 4))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    purchase_order: Mapped[PurchaseOrder] = relationship(back_populates="goods_receipts")
    supplier_invoice: Mapped[SupplierInvoice | None] = relationship(
        back_populates="goods_receipts"
    )
    items: Mapped[list[ComprasGoodsReceiptItem]] = relationship(
        back_populates="receipt", cascade="all, delete-orphan"
    )


class ComprasGoodsReceiptItem(Base):
    """Partida de recepción de mercancía.

    Al insertar, el trigger fn_create_inv_movement_from_receipt
    crea un movimiento RECEIPT y actualiza el costo promedio en inventario.
    """

    __tablename__ = "goods_receipt_items"
    __table_args__ = (
        UniqueConstraint("receipt_id", "line_number", name="uq_gri_receipt_line"),
    )

    receipt_item_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    receipt_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("goods_receipts.receipt_id", ondelete="CASCADE"), nullable=False, index=True
    )
    po_item_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("purchase_order_items.po_item_id", ondelete="RESTRICT"), nullable=False, index=True
    )
    line_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("productos.id", ondelete="SET NULL"), index=True
    )
    quantity_requested: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    quantity_received: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    unit_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    receipt: Mapped[ComprasGoodsReceipt] = relationship(back_populates="items")
    po_item: Mapped[PurchaseOrderItem] = relationship(back_populates="goods_receipt_items")
    supplier_invoice_items: Mapped[list["SupplierInvoiceItem"]] = relationship(
        back_populates="receipt_item"
    )


# ---------------------------------------------------------------------------
# Facturas del Proveedor (Supplier Invoices)
# ---------------------------------------------------------------------------


class SupplierInvoice(Base):
    """Factura emitida por el proveedor.

    is_credit se calcula automáticamente: True cuando sat_payment_method_id = 'PPD'.
    El trigger fn_validate_invoice_chain impide pagar facturas GOODS/MIXED sin GR.
    """

    __tablename__ = "supplier_invoices"
    __table_args__ = (
        UniqueConstraint("supplier_id", "invoice_number", name="uq_si_supplier_invoice"),
    )

    invoice_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    invoice_number: Mapped[str] = mapped_column(nullable=False)
    supplier_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("suppliers.supplier_id", ondelete="RESTRICT"), nullable=False, index=True
    )
    po_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("purchase_orders.po_id", ondelete="SET NULL"), index=True
    )
    invoice_type: Mapped[str] = mapped_column(nullable=False, default="GOODS")
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    received_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(nullable=False, default="RECEIVED", index=True)
    payment_status: Mapped[str] = mapped_column(nullable=False, default="UNPAID", index=True)
    payment_date: Mapped[date | None] = mapped_column(Date)
    sat_payment_form_id: Mapped[str | None] = mapped_column(
        ForeignKey("sat_payment_forms.form_id", ondelete="SET NULL")
    )
    sat_payment_method_id: Mapped[str | None] = mapped_column(
        ForeignKey("sat_payment_methods.method_id", ondelete="SET NULL")
    )
    is_credit: Mapped[bool | None] = mapped_column(
        Boolean,
        Computed("sat_payment_method_id = 'PPD'", persisted=True),
    )
    uuid_sat: Mapped[str | None]
    subtotal: Mapped[float | None] = mapped_column(Numeric(14, 4))
    tax_amount: Mapped[float | None] = mapped_column(Numeric(14, 4))
    shipping_amount: Mapped[float | None] = mapped_column(Numeric(14, 4))
    discount_amount: Mapped[float | None] = mapped_column(Numeric(14, 4))
    total: Mapped[float | None] = mapped_column(Numeric(14, 4))
    currency: Mapped[str] = mapped_column(nullable=False, default="MXN")
    exchange_rate: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False, default=1)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    purchase_order: Mapped[PurchaseOrder | None] = relationship(back_populates="supplier_invoices")
    payment_form: Mapped[SatPaymentForm | None] = relationship(back_populates="supplier_invoices")
    payment_method: Mapped[SatPaymentMethod | None] = relationship(
        back_populates="supplier_invoices"
    )
    goods_receipts: Mapped[list[ComprasGoodsReceipt]] = relationship(back_populates="supplier_invoice")
    items: Mapped[list[SupplierInvoiceItem]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )


class SupplierInvoiceItem(Base):
    """Partida de factura de proveedor."""

    __tablename__ = "supplier_invoice_items"
    __table_args__ = (
        CheckConstraint(
            "(item_type IN ('GOODS_RESALE','GOODS_INTERNAL') AND product_id IS NOT NULL)"
            " OR (item_type = 'SERVICE' AND concept_description IS NOT NULL)",
            name="chk_sii_product_or_service",
        ),
        UniqueConstraint("invoice_id", "line_number", name="uq_sii_invoice_line"),
    )

    invoice_item_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    invoice_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("supplier_invoices.invoice_id", ondelete="CASCADE"), nullable=False, index=True
    )
    po_item_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("purchase_order_items.po_item_id", ondelete="SET NULL")
    )
    receipt_item_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("goods_receipt_items.receipt_item_id", ondelete="SET NULL")
    )
    line_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    item_type: Mapped[str] = mapped_column(nullable=False, default="GOODS_RESALE")
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("productos.id", ondelete="SET NULL"), index=True
    )
    concept_description: Mapped[str | None] = mapped_column(Text)
    unit_of_measure: Mapped[str | None]
    quantity: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    unit_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    tax_pct: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=16)
    subtotal: Mapped[float | None] = mapped_column(
        Numeric(14, 4),
        Computed(
            "CASE WHEN unit_cost IS NULL OR quantity IS NULL THEN NULL"
            " ELSE quantity * unit_cost END",
            persisted=True,
        ),
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    invoice: Mapped[SupplierInvoice] = relationship(back_populates="items")
    po_item: Mapped[PurchaseOrderItem | None] = relationship(
        back_populates="supplier_invoice_items"
    )
    receipt_item: Mapped[ComprasGoodsReceiptItem | None] = relationship(
        back_populates="supplier_invoice_items"
    )

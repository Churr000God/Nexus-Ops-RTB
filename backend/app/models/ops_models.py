from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Customer(Base):
    __tablename__ = "clientes"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    external_id: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    category: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str | None] = mapped_column(String(40))
    rfc: Mapped[str | None] = mapped_column(String(20))
    main_contact: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    annual_purchase: Mapped[float | None] = mapped_column(Numeric(14, 2))
    last_purchase_date: Mapped[date | None] = mapped_column(Date)
    avg_payment_days: Mapped[float | None] = mapped_column(Numeric(10, 2))
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

    quotes: Mapped[list[Quote]] = relationship(back_populates="customer")
    orders: Mapped[list[CustomerOrder]] = relationship(back_populates="customer")
    sales: Mapped[list[Sale]] = relationship(back_populates="customer")


class Supplier(Base):
    __tablename__ = "proveedores"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    external_id: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    category: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str | None] = mapped_column(String(40))
    rfc: Mapped[str | None] = mapped_column(String(20))
    main_contact: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    annual_purchase: Mapped[float | None] = mapped_column(Numeric(14, 2))
    last_purchase_date: Mapped[date | None] = mapped_column(Date)
    avg_payment_days: Mapped[float | None] = mapped_column(Numeric(10, 2))
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

    supplier_orders: Mapped[list[SupplierOrder]] = relationship(
        back_populates="supplier"
    )
    purchase_invoices: Mapped[list[PurchaseInvoice]] = relationship(
        back_populates="supplier"
    )
    operating_expenses: Mapped[list[OperatingExpense]] = relationship(
        back_populates="supplier"
    )
    material_requests: Mapped[list[MaterialRequest]] = relationship(
        back_populates="supplier"
    )
    goods_receipts: Mapped[list[GoodsReceipt]] = relationship(back_populates="supplier")


class Product(Base):
    __tablename__ = "productos"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    sku: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    internal_code: Mapped[str | None] = mapped_column(
        String(80), unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(String(40))
    sale_type: Mapped[str | None] = mapped_column(String(40))
    package_size: Mapped[str | None] = mapped_column(String(40))
    brand: Mapped[str | None] = mapped_column(String(80))
    category: Mapped[str | None] = mapped_column(String(80), index=True)
    unit_price: Mapped[float | None] = mapped_column(Numeric(14, 4))
    purchase_cost_parts: Mapped[float | None] = mapped_column(Numeric(14, 4))
    purchase_cost_ariba: Mapped[float | None] = mapped_column(Numeric(14, 4))
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

    quote_items: Mapped[list[QuoteItem]] = relationship(back_populates="product")
    inventory_items: Mapped[list[InventoryItem]] = relationship(
        back_populates="product"
    )
    inventory_movements: Mapped[list[InventoryMovement]] = relationship(
        back_populates="product"
    )
    nonconformities: Mapped[list[NonConformity]] = relationship(
        back_populates="product"
    )
    material_requests: Mapped[list[MaterialRequest]] = relationship(
        back_populates="product"
    )
    goods_receipts: Mapped[list[GoodsReceipt]] = relationship(back_populates="product")


class Quote(Base):
    __tablename__ = "cotizaciones"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    status: Mapped[str | None] = mapped_column(String(40), index=True)
    order_status: Mapped[str | None] = mapped_column(String(40), index=True)
    customer_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("clientes.id", ondelete="SET NULL"), index=True
    )
    external_customer_id: Mapped[str | None] = mapped_column(String(80), index=True)
    created_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )
    approved_on: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    followed_up_on: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    discount: Mapped[float | None] = mapped_column(Numeric(14, 4))
    shipping_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    credit: Mapped[float | None] = mapped_column(Numeric(14, 4))
    months: Mapped[int | None] = mapped_column(Integer)
    total: Mapped[float | None] = mapped_column(Numeric(14, 4))
    subtotal: Mapped[float | None] = mapped_column(Numeric(14, 4))
    purchase_subtotal: Mapped[float | None] = mapped_column(Numeric(14, 4))
    payment_time: Mapped[str | None] = mapped_column(String(80))
    payment_type: Mapped[str | None] = mapped_column(String(80))
    missing_products: Mapped[int | None] = mapped_column(Integer)
    packed_percent: Mapped[float | None] = mapped_column(Numeric(6, 2))
    ariba_status: Mapped[str | None] = mapped_column(String(80))
    customer_code: Mapped[str | None] = mapped_column(String(40), index=True)
    delivery_role: Mapped[str | None] = mapped_column(String(80))
    packed_on: Mapped[date | None] = mapped_column(Date)
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

    customer: Mapped[Customer | None] = relationship(back_populates="quotes")
    items: Mapped[list[QuoteItem]] = relationship(
        back_populates="quote", cascade="all, delete-orphan"
    )
    sales: Mapped[list[Sale]] = relationship(back_populates="quote")
    orders: Mapped[list[CustomerOrder]] = relationship(back_populates="quote")
    cancellations: Mapped[list[CancelledQuote]] = relationship(back_populates="quote")


class QuoteItem(Base):
    __tablename__ = "cotizacion_items"
    __table_args__ = (
        UniqueConstraint(
            "quote_id", "line_external_id", name="uq_cotizacion_items_quote_line"
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    quote_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cotizaciones.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    line_external_id: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str | None] = mapped_column(String(40), index=True)
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="SET NULL"),
        index=True,
    )
    external_product_id: Mapped[str | None] = mapped_column(String(80), index=True)
    sku: Mapped[str | None] = mapped_column(String(80), index=True)
    category: Mapped[str | None] = mapped_column(String(80))
    qty_requested: Mapped[float | None] = mapped_column(Numeric(14, 4))
    qty_packed: Mapped[float | None] = mapped_column(Numeric(14, 4))
    qty_missing: Mapped[float | None] = mapped_column(Numeric(14, 4))
    unit_cost_purchase: Mapped[float | None] = mapped_column(Numeric(14, 4))
    unit_cost_sale: Mapped[float | None] = mapped_column(Numeric(14, 4))
    subtotal: Mapped[float | None] = mapped_column(Numeric(14, 4))
    purchase_subtotal: Mapped[float | None] = mapped_column(Numeric(14, 4))
    accumulated_sales: Mapped[float | None] = mapped_column(Numeric(14, 4))
    last_90_days: Mapped[float | None] = mapped_column(Numeric(14, 4))
    last_180_days: Mapped[float | None] = mapped_column(Numeric(14, 4))
    quote_status: Mapped[str | None] = mapped_column(String(40))
    external_customer_id: Mapped[str | None] = mapped_column(String(80), index=True)
    last_updated_on: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
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

    quote: Mapped[Quote] = relationship(back_populates="items")
    product: Mapped[Product | None] = relationship(back_populates="quote_items")


class CancelledQuote(Base):
    __tablename__ = "cotizaciones_canceladas"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    quote_number: Mapped[str | None] = mapped_column(String(120), index=True)
    cancelled_on: Mapped[date | None] = mapped_column(Date, index=True)
    reason: Mapped[str | None] = mapped_column(Text)
    quote_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cotizaciones.id", ondelete="SET NULL"),
        index=True,
    )
    external_customer_id: Mapped[str | None] = mapped_column(String(80), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    quote: Mapped[Quote | None] = relationship(back_populates="cancellations")


class Sale(Base):
    __tablename__ = "ventas"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    sold_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("clientes.id", ondelete="SET NULL"), index=True
    )
    external_customer_id: Mapped[str | None] = mapped_column(String(80), index=True)
    status: Mapped[str | None] = mapped_column(String(40), index=True)
    subtotal: Mapped[float | None] = mapped_column(Numeric(14, 4))
    total: Mapped[float | None] = mapped_column(Numeric(14, 4))
    purchase_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    gross_margin: Mapped[float | None] = mapped_column(Numeric(14, 4))
    margin_percent: Mapped[float | None] = mapped_column(Numeric(6, 2))
    diff_vs_po: Mapped[float | None] = mapped_column(Numeric(14, 4))
    packed_percent: Mapped[float | None] = mapped_column(Numeric(6, 2))
    year_month: Mapped[str | None] = mapped_column(String(20), index=True)
    quadrimester: Mapped[str | None] = mapped_column(String(20), index=True)
    status_r: Mapped[str | None] = mapped_column(String(40))
    quote_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cotizaciones.id", ondelete="SET NULL"),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    customer: Mapped[Customer | None] = relationship(back_populates="sales")
    quote: Mapped[Quote | None] = relationship(back_populates="sales")


class InventoryItem(Base):
    __tablename__ = "inventario"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="SET NULL"),
        index=True,
    )
    external_product_id: Mapped[str | None] = mapped_column(String(80), index=True)
    internal_code: Mapped[str | None] = mapped_column(String(80), index=True)
    real_qty: Mapped[float | None] = mapped_column(Numeric(14, 4))
    theoretical_qty: Mapped[float | None] = mapped_column(Numeric(14, 4))
    stock_diff: Mapped[float | None] = mapped_column(Numeric(14, 4))
    unit_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    stock_total_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    status_real: Mapped[str | None] = mapped_column(String(40))
    stock_alert: Mapped[str | None] = mapped_column(String(40))
    purchase_block: Mapped[bool | None] = mapped_column(Boolean)
    days_without_movement: Mapped[int | None] = mapped_column(Integer)
    movement_traffic_light: Mapped[str | None] = mapped_column(String(40))
    aging_classification: Mapped[str | None] = mapped_column(String(40))
    rotation_classification: Mapped[str | None] = mapped_column(String(40))
    abc_classification: Mapped[str | None] = mapped_column(String(40))
    suggested_action: Mapped[str | None] = mapped_column(String(255))
    last_inbound_on: Mapped[date | None] = mapped_column(Date)
    last_outbound_on: Mapped[date | None] = mapped_column(Date)
    demand_history: Mapped[str | None] = mapped_column(String(80))
    total_accumulated_sales: Mapped[float | None] = mapped_column(Numeric(14, 4))
    processed: Mapped[bool | None] = mapped_column(Boolean)
    reviewed: Mapped[bool | None] = mapped_column(Boolean)
    physical_diff: Mapped[float | None] = mapped_column(Numeric(14, 4))
    raw_payload: Mapped[dict | None] = mapped_column(JSON)
    updated_on: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    product: Mapped[Product | None] = relationship(back_populates="inventory_items")


class InventoryMovement(Base):
    __tablename__ = "movimientos_inventario"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="SET NULL"),
        index=True,
    )
    external_product_id: Mapped[str | None] = mapped_column(String(80), index=True)
    movement_type: Mapped[str | None] = mapped_column(String(40), index=True)
    qty_in: Mapped[float | None] = mapped_column(Numeric(14, 4))
    qty_out: Mapped[float | None] = mapped_column(Numeric(14, 4))
    moved_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )
    origin: Mapped[str | None] = mapped_column(String(255))
    destination: Mapped[str | None] = mapped_column(String(255))
    raw_payload: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    product: Mapped[Product | None] = relationship(back_populates="inventory_movements")


class InventoryGrowth(Base):
    __tablename__ = "crecimiento_inventario"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    registered_on: Mapped[date | None] = mapped_column(Date, index=True)
    amount: Mapped[float | None] = mapped_column(Numeric(14, 4))
    growth_type: Mapped[str | None] = mapped_column(String(80), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class NonConformity(Base):
    __tablename__ = "no_conformes"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    folio: Mapped[str | None] = mapped_column(String(80), index=True)
    detected_on: Mapped[date | None] = mapped_column(Date, index=True)
    quantity: Mapped[float | None] = mapped_column(Numeric(14, 4))
    reason: Mapped[str | None] = mapped_column(Text)
    action_taken: Mapped[str | None] = mapped_column(Text)
    adjustment_type: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str | None] = mapped_column(String(40), index=True)
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="SET NULL"),
        index=True,
    )
    external_product_id: Mapped[str | None] = mapped_column(String(80), index=True)
    inventory_item_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("inventario.id", ondelete="SET NULL"),
        index=True,
    )
    purchase_invoice_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("facturas_compras.id", ondelete="SET NULL"),
        index=True,
    )
    customer_order_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("pedidos_clientes.id", ondelete="SET NULL"),
        index=True,
    )
    detected_by: Mapped[str | None] = mapped_column(String(255))
    inventory_adjustment: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    temporary_physical_location: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    product: Mapped[Product | None] = relationship(back_populates="nonconformities")


class MaterialRequest(Base):
    __tablename__ = "solicitudes_material"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="SET NULL"),
        index=True,
    )
    product_sku: Mapped[str | None] = mapped_column(String(80), index=True)
    external_product_id: Mapped[str | None] = mapped_column(String(80), index=True)
    qty_requested: Mapped[float | None] = mapped_column(Numeric(14, 4))
    qty_requested_converted: Mapped[float | None] = mapped_column(Numeric(14, 4))
    requested_on: Mapped[date | None] = mapped_column(Date, index=True)
    status: Mapped[str | None] = mapped_column(String(40), index=True)
    supplier_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("proveedores.id", ondelete="SET NULL"),
        index=True,
    )
    external_supplier_id: Mapped[str | None] = mapped_column(String(80), index=True)
    unit_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    total_amount: Mapped[float | None] = mapped_column(Numeric(14, 4))
    package_size: Mapped[str | None] = mapped_column(String(80))
    days_without_movement: Mapped[int | None] = mapped_column(Integer)
    blocked_by_dormant_inventory: Mapped[bool | None] = mapped_column(Boolean)
    purchase_exception_reason: Mapped[str | None] = mapped_column(Text)
    demand_history: Mapped[str | None] = mapped_column(String(80))
    last_valid_outbound_on: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    supplier: Mapped[Supplier | None] = relationship(back_populates="material_requests")
    product: Mapped[Product | None] = relationship(back_populates="material_requests")


class GoodsReceipt(Base):
    __tablename__ = "entradas_mercancia"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    entry_number: Mapped[str | None] = mapped_column(String(80), index=True)
    qty_requested: Mapped[float | None] = mapped_column(Numeric(14, 4))
    qty_arrived: Mapped[float | None] = mapped_column(Numeric(14, 4))
    supplier_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("proveedores.id", ondelete="SET NULL"),
        index=True,
    )
    external_supplier_id: Mapped[str | None] = mapped_column(String(80), index=True)
    internal_code: Mapped[str | None] = mapped_column(String(80), index=True)
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="SET NULL"),
        index=True,
    )
    external_product_id: Mapped[str | None] = mapped_column(String(80), index=True)
    unit_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    total_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    received_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )
    delivery_percent: Mapped[float | None] = mapped_column(Numeric(6, 2))
    physical_validation: Mapped[str | None] = mapped_column(String(80))
    paid_on: Mapped[date | None] = mapped_column(Date)
    payment_status: Mapped[str | None] = mapped_column(String(40))
    payment_type: Mapped[str | None] = mapped_column(String(80))
    purchase_invoice_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("facturas_compras.id", ondelete="SET NULL"),
        index=True,
    )
    tdp: Mapped[str | None] = mapped_column(String(80))
    qty_requested_converted: Mapped[float | None] = mapped_column(Numeric(14, 4))
    validated_by: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    supplier: Mapped[Supplier | None] = relationship(back_populates="goods_receipts")
    product: Mapped[Product | None] = relationship(back_populates="goods_receipts")


class SupplierOrder(Base):
    __tablename__ = "pedidos_proveedor"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    order_folio: Mapped[str | None] = mapped_column(String(80), index=True)
    order_status: Mapped[str | None] = mapped_column(String(40), index=True)
    pickup_status: Mapped[str | None] = mapped_column(String(40), index=True)
    generated_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )
    sent_on: Mapped[date | None] = mapped_column(Date)
    confirmed_on: Mapped[date | None] = mapped_column(Date)
    estimated_pickup_on: Mapped[date | None] = mapped_column(Date)
    pickup_on: Mapped[date | None] = mapped_column(Date)
    supplier_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("proveedores.id", ondelete="SET NULL"),
        index=True,
    )
    external_supplier_id: Mapped[str | None] = mapped_column(String(80), index=True)
    products_requested: Mapped[list[str] | None] = mapped_column(JSON)
    subtotal: Mapped[float | None] = mapped_column(Numeric(14, 4))
    shipping_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    iva: Mapped[float | None] = mapped_column(Numeric(14, 4))
    total: Mapped[float | None] = mapped_column(Numeric(14, 4))
    is_confirmed: Mapped[bool | None] = mapped_column(Boolean)
    sent_by_email: Mapped[bool | None] = mapped_column(Boolean)
    is_printed: Mapped[bool | None] = mapped_column(Boolean)
    followup_responsibles: Mapped[list[str] | None] = mapped_column(JSON)
    purchase_invoice_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("facturas_compras.id", ondelete="SET NULL"),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    supplier: Mapped[Supplier | None] = relationship(back_populates="supplier_orders")


class PurchaseInvoice(Base):
    __tablename__ = "facturas_compras"
    __table_args__ = (
        CheckConstraint("subtotal >= 0", name="ck_facturas_compras_subtotal_nonneg"),
        CheckConstraint("total >= 0", name="ck_facturas_compras_total_nonneg"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    quote_number: Mapped[str | None] = mapped_column(String(80), index=True)
    invoice_number: Mapped[str | None] = mapped_column(String(80), index=True)
    supplier_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("proveedores.id", ondelete="SET NULL"),
        index=True,
    )
    external_supplier_id: Mapped[str | None] = mapped_column(String(80), index=True)
    supplier_rfc: Mapped[str | None] = mapped_column(String(20))
    received_on: Mapped[date | None] = mapped_column(Date)
    invoice_on: Mapped[date | None] = mapped_column(Date, index=True)
    paid_on: Mapped[date | None] = mapped_column(Date)
    shipping_insurance_discount: Mapped[float | None] = mapped_column(Numeric(14, 4))
    purchase_type: Mapped[str | None] = mapped_column(String(80))
    payment_type: Mapped[str | None] = mapped_column(String(80))
    order_status: Mapped[str | None] = mapped_column(String(40), index=True)
    payment_status: Mapped[str | None] = mapped_column(String(40), index=True)
    invoice_status: Mapped[str | None] = mapped_column(String(40), index=True)
    subtotal: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)
    iva: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)
    total: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)
    delivered_percent: Mapped[float | None] = mapped_column(Numeric(6, 2))
    related_goods_receipts: Mapped[list[str] | None] = mapped_column(JSON)
    review_responsible: Mapped[str | None] = mapped_column(String(255))
    related_nonconformities: Mapped[list[str] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    supplier: Mapped[Supplier | None] = relationship(back_populates="purchase_invoices")


class OperatingExpense(Base):
    __tablename__ = "gastos_operativos"
    __table_args__ = (
        CheckConstraint("total >= 0", name="ck_gastos_operativos_total_nonneg"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    concept: Mapped[str] = mapped_column(String(255), nullable=False)
    invoice_folio: Mapped[str | None] = mapped_column(String(120), index=True)
    subtotal: Mapped[float | None] = mapped_column(Numeric(14, 4))
    iva: Mapped[float | None] = mapped_column(Numeric(14, 4))
    total: Mapped[float | None] = mapped_column(Numeric(14, 4))
    spent_on: Mapped[date | None] = mapped_column(Date, index=True)
    is_deductible: Mapped[bool | None] = mapped_column(Boolean, index=True)
    category: Mapped[str | None] = mapped_column(String(80), index=True)
    payment_method: Mapped[str | None] = mapped_column(String(80), index=True)
    status: Mapped[str | None] = mapped_column(String(40), index=True)
    responsible: Mapped[str | None] = mapped_column(String(255))
    supplier_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("proveedores.id", ondelete="SET NULL"),
        index=True,
    )
    supplier_name: Mapped[str | None] = mapped_column(String(255))
    supplier_rfc: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    supplier: Mapped[Supplier | None] = relationship(
        back_populates="operating_expenses"
    )


class CustomerOrder(Base):
    __tablename__ = "pedidos_clientes"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    customer_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("clientes.id", ondelete="SET NULL"), index=True
    )
    external_customer_id: Mapped[str | None] = mapped_column(String(80), index=True)
    customer_code: Mapped[str | None] = mapped_column(String(40), index=True)
    payment_type: Mapped[str | None] = mapped_column(String(80))
    invoice_status: Mapped[str | None] = mapped_column(String(40))
    order_status: Mapped[str | None] = mapped_column(String(40), index=True)
    payment_status: Mapped[str | None] = mapped_column(String(40), index=True)
    ordered_on: Mapped[date | None] = mapped_column(Date, index=True)
    validated_on: Mapped[date | None] = mapped_column(Date)
    approved_on: Mapped[date | None] = mapped_column(Date)
    associated_on: Mapped[date | None] = mapped_column(Date)
    shipped_on: Mapped[date | None] = mapped_column(Date)
    delivered_on: Mapped[date | None] = mapped_column(Date)
    invoiced_on: Mapped[date | None] = mapped_column(Date)
    paid_on: Mapped[date | None] = mapped_column(Date)
    fulfillment_responsible: Mapped[str | None] = mapped_column(String(255))
    quote_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cotizaciones.id", ondelete="SET NULL"),
        index=True,
    )
    has_missing_items: Mapped[bool | None] = mapped_column(Boolean)
    delivery_type: Mapped[str | None] = mapped_column(String(80))
    total: Mapped[float | None] = mapped_column(Numeric(14, 4))
    subtotal_with_shipping: Mapped[float | None] = mapped_column(Numeric(14, 4))
    delivery_time: Mapped[str | None] = mapped_column(String(80))
    payment_times: Mapped[str | None] = mapped_column(String(80))
    preparation_times: Mapped[str | None] = mapped_column(String(80))
    packed_percent: Mapped[str | None] = mapped_column(String(40))
    raw_payload: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    customer: Mapped[Customer | None] = relationship(back_populates="orders")
    quote: Mapped[Quote | None] = relationship(back_populates="orders")


class IncompleteOrder(Base):
    __tablename__ = "pedidos_incompletos"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    customer_order_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("pedidos_clientes.id", ondelete="SET NULL"),
        index=True,
    )
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="SET NULL"),
        index=True,
    )
    reason: Mapped[str | None] = mapped_column(Text)
    aging_days: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class OrderDateVerification(Base):
    __tablename__ = "verificador_fechas_pedidos"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    customer_order_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("pedidos_clientes.id", ondelete="SET NULL"),
        index=True,
    )
    order_name: Mapped[str | None] = mapped_column(String(255), index=True)
    event_type: Mapped[str | None] = mapped_column(String(80), index=True)
    event_date: Mapped[date | None] = mapped_column(Date, index=True)
    event_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    triggered_by: Mapped[str | None] = mapped_column(String(255))
    external_customer_id: Mapped[str | None] = mapped_column(String(80), index=True)
    quote_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cotizaciones.id", ondelete="SET NULL"),
        index=True,
    )
    order_link: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class CsvImportRun(Base):
    __tablename__ = "csv_import_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    source_filename: Mapped[str | None] = mapped_column(String(255))
    source_sha256: Mapped[str | None] = mapped_column(String(64))
    row_count: Mapped[int | None] = mapped_column(Integer)
    inserted_count: Mapped[int | None] = mapped_column(Integer)
    updated_count: Mapped[int | None] = mapped_column(Integer)
    skipped_count: Mapped[int | None] = mapped_column(Integer)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="running")
    error_message: Mapped[str | None] = mapped_column(Text)

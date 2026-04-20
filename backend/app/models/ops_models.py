"""Modelos SQLAlchemy para la base operativa Nexus Ops RTB.

Este archivo implementa las 17 bases descritas en
``Documentación de Bases de Datos — RTB`` (ver ``docs/estructura_bd_rtb.md``).

Convenciones:
    * Los nombres de tabla se mantienen en español para coincidir con el dominio
      del negocio (``productos``, ``clientes``, ``proveedores`` …).
    * Los nombres de columna se mantienen en inglés (convención del backend).
    * Todas las tablas de maestros incluyen ``created_at`` / ``updated_at``.
    * Los campos calculados (rollups/fórmulas de Notion) se almacenan como
      columnas denormalizadas y se recalculan mediante:
        - ``GENERATED ALWAYS AS ... STORED`` cuando la fórmula es simple
          y se puede expresar en un único registro (p. ej. ``IVA = subtotal * 0.16``).
        - Triggers de Postgres o servicios Python para fórmulas que requieren
          agregaciones o cruzar tablas (p. ej. ``% margen``, ``cantidad_real``).
      El script ``scripts/bootstrap_triggers.sql`` declara los triggers.
    * Se conservan los campos denominados ``external_id`` / ``external_*_id`` para
      mantener compatibilidad con los flujos de ingesta CSV/n8n existentes.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import (
    Computed,
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


# ---------------------------------------------------------------------------
# Catálogos maestros auxiliares (Categorías y Marcas)
# ---------------------------------------------------------------------------


class Category(Base):
    """Catálogo de categorías de producto.

    Fuente del rollup ``PORCENTAJE DE GANANCIA`` del Catálogo de Productos.
    """

    __tablename__ = "categorias"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    name: Mapped[str] = mapped_column(
        String(120), nullable=False, unique=True, index=True
    )
    description: Mapped[str | None] = mapped_column(Text)
    profit_margin_percent: Mapped[float | None] = mapped_column(Numeric(6, 4))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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

    products: Mapped[list[Product]] = relationship(back_populates="category_ref")


class Brand(Base):
    """Catálogo de marcas.

    Fuente del rollup ``Porcentaje de subida`` (markup) hacia el Catálogo
    de Productos. Cuando se combine con el precio de proveedor,
    ``precio_unitario = (1 + markup_percent) * precio_base``.
    """

    __tablename__ = "marcas"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    name: Mapped[str] = mapped_column(
        String(120), nullable=False, unique=True, index=True
    )
    description: Mapped[str | None] = mapped_column(Text)
    markup_percent: Mapped[float | None] = mapped_column(Numeric(6, 4))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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

    products: Mapped[list[Product]] = relationship(back_populates="brand_ref")


# ---------------------------------------------------------------------------
# Directorio: Clientes y Proveedores (separados)
# ---------------------------------------------------------------------------


class Customer(Base):
    """Clientes del Directorio de Ubicaciones (Tipo = Cliente)."""

    __tablename__ = "clientes"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    external_id: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    short_code: Mapped[str | None] = mapped_column(
        String(40), index=True
    )  # Siglas / ID
    legal_name: Mapped[str | None] = mapped_column(String(255))  # Razón Social
    rfc: Mapped[str | None] = mapped_column(String(20))
    main_contact: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(255))
    website: Mapped[str | None] = mapped_column(String(255))  # Sitio Web
    address: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(40))  # Foraneo / Local
    status: Mapped[str | None] = mapped_column(
        String(40)
    )  # Prospecto / Activo / Inactivo
    annual_purchase: Mapped[float | None] = mapped_column(
        Numeric(14, 2)
    )  # COMPRA ANUAL rollup
    last_purchase_date: Mapped[date | None] = mapped_column(
        Date
    )  # ULTIMA COMPRA rollup
    avg_payment_days: Mapped[float | None] = mapped_column(Numeric(10, 2))  # TPP rollup
    notes: Mapped[str | None] = mapped_column(Text)
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
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
    date_verifications: Mapped[list[OrderDateVerification]] = relationship(
        back_populates="customer"
    )


class Supplier(Base):
    """Proveedores del Directorio de Ubicaciones (Tipo = Proveedor)."""

    __tablename__ = "proveedores"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    external_id: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    short_code: Mapped[str | None] = mapped_column(
        String(40), index=True
    )  # Siglas / ID
    legal_name: Mapped[str | None] = mapped_column(String(255))  # Razón Social
    rfc: Mapped[str | None] = mapped_column(String(20))
    main_contact: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(255))
    website: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(40))  # Foraneo / Local
    status: Mapped[str | None] = mapped_column(String(40))
    annual_purchase: Mapped[float | None] = mapped_column(Numeric(14, 2))
    last_purchase_date: Mapped[date | None] = mapped_column(Date)
    avg_payment_days: Mapped[float | None] = mapped_column(Numeric(10, 2))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
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
    supplier_products: Mapped[list[SupplierProduct]] = relationship(
        back_populates="supplier"
    )


# ---------------------------------------------------------------------------
# Catálogo de Productos (1)
# ---------------------------------------------------------------------------


class Product(Base):
    """Catálogo maestro de productos (SKU, precio, imagen, relaciones)."""

    __tablename__ = "productos"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    sku: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    internal_code: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True
    )
    sat_code: Mapped[str | None] = mapped_column(String(80), index=True)  # Codigo SAT
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(String(40))
    # Activo / Dado de Baja / Agotado / Próximamente / Descontinuado / Pendiente
    sale_type: Mapped[str | None] = mapped_column(String(40))
    # Por Pieza / Por Caja / Ambos / Blister / Por Paquete / Por Juego / Por Bolsa …
    package_size: Mapped[float | None] = mapped_column(
        Numeric(10, 2)
    )  # Tamaño del Paquete
    brand_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("marcas.id", ondelete="SET NULL"), index=True
    )
    category_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("categorias.id", ondelete="SET NULL"),
        index=True,
    )
    brand: Mapped[str | None] = mapped_column(String(80))  # denormalizado (cache)
    category: Mapped[str | None] = mapped_column(
        String(80), index=True
    )  # denormalizado
    warehouse_location: Mapped[str | None] = mapped_column(
        String(120)
    )  # Ubicación en Almacén
    image_url: Mapped[str | None] = mapped_column(String(500))  # Imagen
    datasheet_url: Mapped[str | None] = mapped_column(String(500))  # Ficha Técnica
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # --- Precios y costos ---
    unit_price: Mapped[float | None] = mapped_column(Numeric(14, 4))
    # Precio Unitario = (1 + Porcentaje de subida) * Precio Unitario R  (rollup)
    unit_price_base: Mapped[float | None] = mapped_column(Numeric(14, 4))
    # Precio Unitario R = avg(Proveedores y Productos → Precio MXN)
    purchase_cost_parts: Mapped[float | None] = mapped_column(Numeric(14, 4))
    # COSTO REFACCIONES
    purchase_cost_ariba: Mapped[float | None] = mapped_column(Numeric(14, 4))
    # COSTO ARIBA
    # --- Rollups de demanda (calculados desde QuoteItem) ---
    theoretical_outflow: Mapped[float | None] = mapped_column(Numeric(14, 4))
    # Salida Teorica
    real_outflow: Mapped[float | None] = mapped_column(Numeric(14, 4))
    # Salida Real Final
    total_accumulated_sales: Mapped[float | None] = mapped_column(Numeric(14, 4))
    # TOTAL VENTA ACUMULADO
    demand_90_days: Mapped[float | None] = mapped_column(Numeric(14, 4))
    demand_180_days: Mapped[float | None] = mapped_column(Numeric(14, 4))
    last_outbound_date: Mapped[date | None] = mapped_column(Date)
    # Ultima Fecha de salida
    committed_demand: Mapped[float | None] = mapped_column(Numeric(14, 4))
    # demanda comprometida (sum desde cotizacion_items activos)
    # --- Metadatos ---
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

    brand_ref: Mapped[Brand | None] = relationship(back_populates="products")
    category_ref: Mapped[Category | None] = relationship(back_populates="products")
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
    supplier_products: Mapped[list[SupplierProduct]] = relationship(
        back_populates="product"
    )
    incomplete_orders: Mapped[list[IncompleteOrder]] = relationship(
        back_populates="product"
    )


# ---------------------------------------------------------------------------
# Proveedores y Productos (2) - tabla puente N↔N con precio
# ---------------------------------------------------------------------------


class SupplierProduct(Base):
    """Relación N↔N entre Producto y Proveedor, con precio y disponibilidad."""

    __tablename__ = "proveedor_productos"
    __table_args__ = (
        UniqueConstraint(
            "product_id",
            "supplier_id",
            "supplier_type",
            name="uq_proveedor_productos_prod_sup_type",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="SET NULL"),
        index=True,
    )
    product_sku: Mapped[str | None] = mapped_column(String(80), index=True)
    product_label: Mapped[str | None] = mapped_column(String(255))
    supplier_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("proveedores.id", ondelete="SET NULL"),
        index=True,
    )
    external_supplier_id: Mapped[str | None] = mapped_column(String(80), index=True)
    supplier_name: Mapped[str | None] = mapped_column(String(255))
    price: Mapped[float | None] = mapped_column(Numeric(14, 4))  # Precio (MXN)
    supplier_type: Mapped[str | None] = mapped_column(String(40))  # Principal / Alterno
    is_available: Mapped[bool | None] = mapped_column(Boolean)  # Disponibilidad
    notes: Mapped[str | None] = mapped_column(Text)
    created_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )
    material_request_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("solicitudes_material.id", ondelete="SET NULL"),
        index=True,
    )
    goods_receipt_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("entradas_mercancia.id", ondelete="SET NULL"),
        index=True,
    )

    supplier: Mapped[Supplier | None] = relationship(back_populates="supplier_products")
    product: Mapped[Product | None] = relationship(back_populates="supplier_products")


# ---------------------------------------------------------------------------
# Cotizaciones a Clientes (7)
# ---------------------------------------------------------------------------


class Quote(Base):
    """Cotizaciones emitidas a clientes.

    Fórmulas clave (recalculadas por trigger/servicio):
        - subtotal_con_envio = (subtotal + shipping_cost) * (1 - discount)
        - interes_mensual    = credito ? 0.0175 : 0
        - interes_total      = interes_mensual * months
        - total              = credito
                                 ? subtotal_con_envio * (1 + interes_total) * 1.16
                                 : subtotal_con_envio * 1.16
        - packed_percent     = productos_empacados / productos_totales * 100
        - order_status       = 0%->Pendiente, 0<x<100->Parcial, 100->Preparado
        - approval_days      = dateBetween(approved_on, created_on)
    """

    __tablename__ = "cotizaciones"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    po_pr: Mapped[str | None] = mapped_column(String(120), index=True)  # PO / PR
    file_url: Mapped[str | None] = mapped_column(String(500))  # Archivo de Cotización
    notes: Mapped[str | None] = mapped_column(Text)

    status: Mapped[str | None] = mapped_column(String(40), index=True)
    # Estado: En Cotización → En revisión → CANCELADA / Aprobada / Rechazada / Expirada
    quote_status: Mapped[str | None] = mapped_column(String(40))
    # Estado de Cotizacion: En Edicion → Procesar → Impresa
    order_status: Mapped[str | None] = mapped_column(String(40), index=True)
    # Estado del pedido: Pendiente / Parcial / Preparado
    ariba_status: Mapped[str | None] = mapped_column(String(80))

    customer_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("clientes.id", ondelete="SET NULL"), index=True
    )
    external_customer_id: Mapped[str | None] = mapped_column(String(80), index=True)
    customer_code: Mapped[str | None] = mapped_column(String(40), index=True)

    created_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )
    approved_on: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    followed_up_on: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    packed_on: Mapped[date | None] = mapped_column(Date)

    # --- Montos y flags ---
    discount: Mapped[float | None] = mapped_column(Numeric(6, 4))  # % Descuento
    shipping_cost: Mapped[float | None] = mapped_column(
        Numeric(14, 4)
    )  # Costo de envío
    credit: Mapped[bool | None] = mapped_column(Boolean)  # Credito / Ariba checkbox
    months: Mapped[int | None] = mapped_column(Integer)
    subtotal: Mapped[float | None] = mapped_column(Numeric(14, 4))
    purchase_subtotal: Mapped[float | None] = mapped_column(Numeric(14, 4))
    # Campos calculados (mantenidos por trigger)
    subtotal_with_shipping: Mapped[float | None] = mapped_column(
        Numeric(14, 4),
        Computed(
            "(subtotal + COALESCE(shipping_cost, 0)) * (1 - COALESCE(discount, 0))",
            persisted=True,
        ),
    )
    monthly_interest: Mapped[float | None] = mapped_column(
        Numeric(8, 6),
        Computed("CASE WHEN credit THEN 0.0175 ELSE 0 END", persisted=True),
    )
    total_interest: Mapped[float | None] = mapped_column(
        Numeric(8, 6),
        Computed(
            "CASE WHEN credit THEN 0.0175 * COALESCE(months, 0) ELSE 0 END",
            persisted=True,
        ),
    )
    total: Mapped[float | None] = mapped_column(
        Numeric(14, 4),
        Computed(
            "CASE "
            "WHEN subtotal IS NULL THEN NULL "
            "WHEN credit THEN "
            "((subtotal + COALESCE(shipping_cost, 0)) * (1 - COALESCE(discount, 0))) "
            "* (1 + (0.0175 * COALESCE(months, 0))) * 1.16 "
            "ELSE "
            "((subtotal + COALESCE(shipping_cost, 0)) * (1 - COALESCE(discount, 0))) "
            "* 1.16 "
            "END",
            persisted=True,
        ),
    )
    missing_products: Mapped[int | None] = mapped_column(Integer)
    packed_percent: Mapped[float | None] = mapped_column(Numeric(6, 2))
    approval_days: Mapped[int | None] = mapped_column(Integer)  # Tiempo de Aprobacion

    payment_time: Mapped[str | None] = mapped_column(String(80))
    payment_type: Mapped[str | None] = mapped_column(String(80))
    delivery_role: Mapped[str | None] = mapped_column(String(80))

    approved_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

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
    incomplete_orders: Mapped[list[IncompleteOrder]] = relationship(
        back_populates="quote"
    )
    date_verifications: Mapped[list[OrderDateVerification]] = relationship(
        back_populates="quote"
    )


class QuoteItem(Base):
    """Detalle de Cotizaciones a Clientes (data-source-47).

    Es la espina dorsal de los rollups Salida Teórica/Real y demanda
    histórica de Productos e Inventario.
    """

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
    category: Mapped[str | None] = mapped_column(String(255))
    qty_requested: Mapped[float | None] = mapped_column(Numeric(14, 4))
    qty_packed: Mapped[float | None] = mapped_column(Numeric(14, 4))
    qty_missing: Mapped[float | None] = mapped_column(
        Numeric(14, 4),
        Computed(
            "CASE "
            "WHEN qty_requested IS NULL THEN NULL "
            "ELSE qty_requested - COALESCE(qty_packed, 0) "
            "END",
            persisted=True,
        ),
    )
    unit_cost_purchase: Mapped[float | None] = mapped_column(Numeric(14, 4))
    unit_cost_sale: Mapped[float | None] = mapped_column(Numeric(14, 4))
    subtotal: Mapped[float | None] = mapped_column(
        Numeric(14, 4),
        Computed(
            "CASE "
            "WHEN qty_requested IS NULL OR unit_cost_sale IS NULL THEN NULL "
            "ELSE qty_requested * unit_cost_sale "
            "END",
            persisted=True,
        ),
    )
    purchase_subtotal: Mapped[float | None] = mapped_column(
        Numeric(14, 4),
        Computed(
            "CASE "
            "WHEN qty_requested IS NULL OR unit_cost_purchase IS NULL THEN NULL "
            "ELSE qty_requested * unit_cost_purchase "
            "END",
            persisted=True,
        ),
    )
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
    inventory_movements: Mapped[list[InventoryMovement]] = relationship(
        back_populates="quote_item_ref"
    )


# ---------------------------------------------------------------------------
# Cotizaciones Canceladas (11)
# ---------------------------------------------------------------------------


class CancelledQuote(Base):
    """Bitácora de cotizaciones canceladas con motivo y evidencia."""

    __tablename__ = "cotizaciones_canceladas"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    quote_number: Mapped[str | None] = mapped_column(String(120), index=True)
    cancelled_on: Mapped[date | None] = mapped_column(Date, index=True)
    reason: Mapped[str | None] = mapped_column(Text)
    cancellation_reason: Mapped[str | None] = mapped_column(String(80))
    # Motivo de Cancelación: Precio no competitivo / Cliente desistió /
    # Proyecto cancelado / Cambio de proveedor / Otro
    evidence_url: Mapped[str | None] = mapped_column(
        String(500)
    )  # Archivo de Cancelación
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


# ---------------------------------------------------------------------------
# Reporte de Ventas (10)
# ---------------------------------------------------------------------------


class Sale(Base):
    """Reporte de Ventas (ventas validadas desde cotizaciones aprobadas).

    Fórmulas:
        - margen_bruto = subtotal - purchase_cost
        - margin_percent = margen_bruto / subtotal
        - total = subtotal * 1.16
        - diff_vs_po = subtotal - subtotal_en_po
        - year_month = formatDate(sold_on, "MMMM YYYY")
        - quadrimester = Ene-Abr / May-Ago / Sep-Dic
    """

    __tablename__ = "ventas"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    sold_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("clientes.id", ondelete="SET NULL"), index=True
    )
    external_customer_id: Mapped[str | None] = mapped_column(String(80), index=True)
    status: Mapped[str | None] = mapped_column(String(40), index=True)
    subtotal: Mapped[float | None] = mapped_column(Numeric(14, 4))
    total: Mapped[float | None] = mapped_column(
        Numeric(14, 4),
        Computed(
            "CASE WHEN subtotal IS NULL THEN NULL ELSE subtotal * 1.16 END",
            persisted=True,
        ),
    )
    purchase_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))  # Costo Compra
    subtotal_in_po: Mapped[float | None] = mapped_column(Numeric(14, 4))
    gross_margin: Mapped[float | None] = mapped_column(
        Numeric(14, 4),
        Computed(
            "CASE "
            "WHEN subtotal IS NULL OR purchase_cost IS NULL THEN NULL "
            "ELSE subtotal - purchase_cost "
            "END",
            persisted=True,
        ),
    )
    margin_percent: Mapped[float | None] = mapped_column(
        Numeric(6, 4),
        Computed(
            "CASE "
            "WHEN subtotal IS NULL OR purchase_cost IS NULL THEN NULL "
            "ELSE (subtotal - purchase_cost) / NULLIF(subtotal, 0) "
            "END",
            persisted=True,
        ),
    )
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


# ---------------------------------------------------------------------------
# Gestión de inventario (4)
# ---------------------------------------------------------------------------


class InventoryItem(Base):
    """Registro de inventario por SKU.

    Fórmulas clave (mantenidas por trigger):
        - real_qty        = inbound_r - outbound_r + nonconformity_adjustment
        - theoretical_qty = inbound_tf - outbound_t
        - stock_total_cost = unit_cost * real_qty
        - status_real     = Sin stock (<0) / 0 (=0) / En stock (>0)
        - stock_alert     = compara contra stock_minimo
        - purchase_block  = real_qty > 0 AND days_without_movement > 180
        - aging_classification (Activo ≤30 / Rotación baja ≤90 /
          Dormido ≤180 / Inactivo ≤365 / Obsoleto >365)
        - abc_classification (A ≥50k / B 10k-49k / C <10k)
    """

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
    internal_code: Mapped[str | None] = mapped_column(String(255), index=True)
    notes: Mapped[str | None] = mapped_column(Text)

    # Cantidades (calculadas por trigger)
    real_qty: Mapped[float | None] = mapped_column(Numeric(14, 4))
    theoretical_qty: Mapped[float | None] = mapped_column(Numeric(14, 4))
    stock_diff: Mapped[float | None] = mapped_column(Numeric(14, 4))
    inbound_real: Mapped[float | None] = mapped_column(Numeric(14, 4))
    inbound_theoretical: Mapped[float | None] = mapped_column(Numeric(14, 4))
    outbound_real: Mapped[float | None] = mapped_column(Numeric(14, 4))
    outbound_theoretical: Mapped[float | None] = mapped_column(Numeric(14, 4))
    nonconformity_adjustment: Mapped[float | None] = mapped_column(Numeric(14, 4))
    # Costos
    unit_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    stock_total_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    # Configuración
    min_stock: Mapped[float | None] = mapped_column(Numeric(14, 4))  # Stock Mínimo
    physical_diff: Mapped[float | None] = mapped_column(Numeric(14, 4))
    # Banderas operativas
    reviewed: Mapped[bool | None] = mapped_column(Boolean)  # Revisado
    arranged: Mapped[bool | None] = mapped_column(Boolean)  # Acomodado
    identified: Mapped[bool | None] = mapped_column(Boolean)  # Identificado
    processed: Mapped[bool | None] = mapped_column(Boolean)  # Procesado
    has_physical_diff: Mapped[bool | None] = mapped_column(Boolean)  # Diferencia Física
    # Semáforos / clasificaciones (calculados)
    status_real: Mapped[str | None] = mapped_column(String(40))
    # Sin stock / 0 / En stock
    stock_alert: Mapped[str | None] = mapped_column(String(40))
    # Bajo mínimo (rojo) / OK (verde) / Sin definir (gris)
    purchase_block: Mapped[bool | None] = mapped_column(Boolean)
    days_without_movement: Mapped[int | None] = mapped_column(Integer)
    movement_traffic_light: Mapped[str | None] = mapped_column(String(40))
    aging_classification: Mapped[str | None] = mapped_column(String(40))
    rotation_classification: Mapped[str | None] = mapped_column(String(40))
    abc_classification: Mapped[str | None] = mapped_column(String(40))
    suggested_action: Mapped[str | None] = mapped_column(String(255))
    # Motivo de excepción de compra
    purchase_exception_reason: Mapped[str | None] = mapped_column(String(80))
    # Pedido confirmado / Cliente estratégico / Refacción crítica /
    # Obra/proyecto especial / Reposición obligatoria / Compra no autorizada
    # Fechas clave
    last_inbound_on: Mapped[date | None] = mapped_column(Date)
    last_outbound_on: Mapped[date | None] = mapped_column(Date)
    # Historial/metadata
    demand_history: Mapped[str | None] = mapped_column(String(80))
    total_accumulated_sales: Mapped[float | None] = mapped_column(Numeric(14, 4))
    raw_payload: Mapped[dict | None] = mapped_column(JSON)
    updated_on: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    product: Mapped[Product | None] = relationship(back_populates="inventory_items")
    nonconformities: Mapped[list[NonConformity]] = relationship(
        back_populates="inventory_item"
    )


# ---------------------------------------------------------------------------
# Bitácora de Movimientos (14)
# ---------------------------------------------------------------------------


class InventoryMovement(Base):
    """Log unificado de movimientos (entradas, salidas, ajustes, devoluciones)."""

    __tablename__ = "movimientos_inventario"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    movement_number: Mapped[str | None] = mapped_column(
        String(80), index=True
    )  # # Movimiento
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="SET NULL"),
        index=True,
    )
    external_product_id: Mapped[str | None] = mapped_column(String(80), index=True)
    movement_type: Mapped[str | None] = mapped_column(String(40), index=True)
    # Entrada · Salida · Ajuste · Devolución · Merma · No conforme
    qty_in: Mapped[float | None] = mapped_column(Numeric(14, 4))
    qty_out: Mapped[float | None] = mapped_column(Numeric(14, 4))
    qty_nonconformity: Mapped[float | None] = mapped_column(Numeric(14, 4))
    moved_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )
    origin: Mapped[str | None] = mapped_column(String(255))
    destination: Mapped[str | None] = mapped_column(String(255))
    observations: Mapped[str | None] = mapped_column(Text)
    # Referencias cruzadas
    goods_receipt_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("entradas_mercancia.id", ondelete="SET NULL"),
        index=True,
    )
    quote_item_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cotizacion_items.id", ondelete="SET NULL"),
        index=True,
    )
    nonconformity_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("no_conformes.id", ondelete="SET NULL"),
        index=True,
    )
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    raw_payload: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    product: Mapped[Product | None] = relationship(back_populates="inventory_movements")
    goods_receipt: Mapped[GoodsReceipt | None] = relationship(
        back_populates="inventory_movements"
    )
    quote_item_ref: Mapped[QuoteItem | None] = relationship(
        back_populates="inventory_movements"
    )
    nonconformity: Mapped[NonConformity | None] = relationship(
        back_populates="inventory_movements"
    )


# ---------------------------------------------------------------------------
# Crecimiento de Inventario (15)
# ---------------------------------------------------------------------------


class InventoryGrowth(Base):
    """Snapshots de valor de inventario y productos sin movimiento."""

    __tablename__ = "crecimiento_inventario"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    registered_on: Mapped[date | None] = mapped_column(Date, index=True)
    amount: Mapped[float | None] = mapped_column(Numeric(14, 4))
    growth_type: Mapped[str | None] = mapped_column(String(80), index=True)
    # Inventario / Productos sin movimiento
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# No Conformes (13)
# ---------------------------------------------------------------------------


class NonConformity(Base):
    """Productos no conformes (dañados, incompletos, devueltos).

    Fórmula Ajuste Inventario (alimenta rollup en inventario):
        - vacío si Cantidad vacía
        - +Cantidad si Acción = "Reingreso a inventario"
        - si Acción = "Ajuste":
            + Tipo Entrada → +Cantidad
            + Tipo Salida  → -Cantidad
        - cualquier otro caso → -Cantidad
    """

    __tablename__ = "no_conformes"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    folio: Mapped[str | None] = mapped_column(String(80), index=True)
    detected_on: Mapped[date | None] = mapped_column(Date, index=True)
    quantity: Mapped[float | None] = mapped_column(Numeric(14, 4))
    reason: Mapped[str | None] = mapped_column(String(80), index=True)
    # Motivo: Dañado / Incompleto / Equivocado / Devuelto / Fuera de especificación / Caduco
    action_taken: Mapped[str | None] = mapped_column(String(80))
    # Devolución a proveedor / Ajuste / Cuarentena / Desecho / Reingreso a inventario
    adjustment_type: Mapped[str | None] = mapped_column(String(40))  # Entrada / Salida
    inventory_adjustment: Mapped[float | None] = mapped_column(
        Numeric(14, 4),
        Computed(
            "CASE "
            "WHEN quantity IS NULL THEN NULL "
            "WHEN action_taken = 'Reingreso a inventario' THEN quantity "
            "WHEN action_taken = 'Ajuste' THEN "
            "CASE "
            "WHEN adjustment_type = 'Entrada' THEN quantity "
            "WHEN adjustment_type = 'Salida' THEN -quantity "
            "ELSE -quantity "
            "END "
            "ELSE -quantity "
            "END",
            persisted=True,
        ),
    )
    # valor calculado con la fórmula Ajuste Inventario
    status: Mapped[str | None] = mapped_column(String(40), index=True)
    # Pendiente / En proceso / En cuarentena / Resuelto / Devuelto
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
    photo_evidence_url: Mapped[str | None] = mapped_column(String(500))
    observations: Mapped[str | None] = mapped_column(Text)
    temporary_physical_location: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    product: Mapped[Product | None] = relationship(back_populates="nonconformities")
    inventory_item: Mapped[InventoryItem | None] = relationship(
        back_populates="nonconformities"
    )
    purchase_invoice: Mapped[PurchaseInvoice | None] = relationship(
        back_populates="nonconformities"
    )
    customer_order: Mapped[CustomerOrder | None] = relationship(
        back_populates="nonconformities"
    )
    inventory_movements: Mapped[list[InventoryMovement]] = relationship(
        back_populates="nonconformity"
    )


# ---------------------------------------------------------------------------
# Solicitudes de Material (12)
# ---------------------------------------------------------------------------


class MaterialRequest(Base):
    """Solicitudes de compra generadas desde Gestión de inventario.

    Fórmulas:
        - monto_total = unit_cost * qty_requested
        - qty_requested_converted = is_packaged ? qty_requested / TDP : qty_requested
    """

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
    qty_requested_converted: Mapped[float | None] = mapped_column(
        Numeric(14, 4),
        Computed(
            "CASE "
            "WHEN is_packaged THEN qty_requested / NULLIF(package_size, 0) "
            "ELSE qty_requested "
            "END",
            persisted=True,
        ),
    )
    is_packaged: Mapped[bool | None] = mapped_column(Boolean)  # Solicitud en Paquete
    notes: Mapped[str | None] = mapped_column(Text)
    requested_on: Mapped[date | None] = mapped_column(Date, index=True)
    status: Mapped[str | None] = mapped_column(String(40), index=True)
    # Pendiente → Revisado → Procesado
    supplier_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("proveedores.id", ondelete="SET NULL"),
        index=True,
    )
    external_supplier_id: Mapped[str | None] = mapped_column(String(80), index=True)
    unit_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    total_amount: Mapped[float | None] = mapped_column(
        Numeric(14, 4),
        Computed(
            "CASE "
            "WHEN unit_cost IS NULL OR qty_requested IS NULL THEN NULL "
            "ELSE unit_cost * qty_requested "
            "END",
            persisted=True,
        ),
    )
    package_size: Mapped[float | None] = mapped_column(Numeric(10, 2))  # TDP
    days_without_movement: Mapped[int | None] = mapped_column(Integer)
    blocked_by_dormant_inventory: Mapped[bool | None] = mapped_column(Boolean)
    purchase_exception_reason: Mapped[str | None] = mapped_column(Text)
    demand_history: Mapped[str | None] = mapped_column(String(80))
    last_valid_outbound_on: Mapped[date | None] = mapped_column(Date)
    # Contactos rollup desde Proveedor (cacheados)
    supplier_contact_name: Mapped[str | None] = mapped_column(String(255))
    supplier_contact_email: Mapped[str | None] = mapped_column(String(255))
    supplier_contact_phone: Mapped[str | None] = mapped_column(String(40))
    supplier_address: Mapped[str | None] = mapped_column(Text)
    # Metadata
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    last_edited_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
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

    supplier: Mapped[Supplier | None] = relationship(back_populates="material_requests")
    product: Mapped[Product | None] = relationship(back_populates="material_requests")


# ---------------------------------------------------------------------------
# Entradas de Mercancía (3)
# ---------------------------------------------------------------------------


class GoodsReceipt(Base):
    """Registro de cada entrada física de mercancía.

    Fórmulas:
        - total_cost = unit_cost * qty_requested
        - delivery_percent = qty_arrived / qty_requested
        - qty_requested_converted = is_packaged ? qty_requested * package_size : qty_requested
    """

    __tablename__ = "entradas_mercancia"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    entry_number: Mapped[str | None] = mapped_column(String(80), index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    qty_requested: Mapped[float | None] = mapped_column(Numeric(14, 4))
    qty_arrived: Mapped[float | None] = mapped_column(Numeric(14, 4))
    qty_requested_converted: Mapped[float | None] = mapped_column(Numeric(14, 4))
    is_packaged: Mapped[bool | None] = mapped_column(Boolean)  # Paquete Solicitado
    physical_validation: Mapped[bool | None] = mapped_column(
        Boolean
    )  # Validación Física
    validated_by: Mapped[str | None] = mapped_column(String(255))
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
    total_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))  # computed
    received_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )
    delivery_percent: Mapped[float | None] = mapped_column(Numeric(6, 4))  # computed
    paid_on: Mapped[date | None] = mapped_column(Date)
    payment_status: Mapped[str | None] = mapped_column(String(40))
    payment_type: Mapped[str | None] = mapped_column(String(80))
    purchase_invoice_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("facturas_compras.id", ondelete="SET NULL"),
        index=True,
    )
    tdp: Mapped[float | None] = mapped_column(Numeric(10, 2))  # Tamaño del Paquete
    package_size: Mapped[float | None] = mapped_column(Numeric(10, 2))
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    last_edited_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
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

    supplier: Mapped[Supplier | None] = relationship(back_populates="goods_receipts")
    product: Mapped[Product | None] = relationship(back_populates="goods_receipts")
    purchase_invoice: Mapped[PurchaseInvoice | None] = relationship(
        back_populates="goods_receipts"
    )
    inventory_movements: Mapped[list[InventoryMovement]] = relationship(
        back_populates="goods_receipt"
    )


# ---------------------------------------------------------------------------
# Pedidos a Proveedor (auxiliar)
# ---------------------------------------------------------------------------


class SupplierOrder(Base):
    """Órdenes de compra enviadas al proveedor."""

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


# ---------------------------------------------------------------------------
# FACTURAS COMPRAS (6)
# ---------------------------------------------------------------------------


class PurchaseInvoice(Base):
    """Control de cotizaciones/compras a proveedores y su facturación.

    Fórmulas:
        - iva   = (subtotal + shipping) * 0.16
        - total = subtotal + shipping + iva - discount
    """

    __tablename__ = "facturas_compras"
    __table_args__ = (
        CheckConstraint("subtotal >= 0", name="ck_facturas_compras_subtotal_nonneg"),
        CheckConstraint("total >= 0", name="ck_facturas_compras_total_nonneg"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    quote_number: Mapped[str | None] = mapped_column(String(255), index=True)
    invoice_number: Mapped[str | None] = mapped_column(String(255), index=True)
    comments: Mapped[str | None] = mapped_column(Text)
    purchase_type: Mapped[str | None] = mapped_column(
        String(40)
    )  # Comercial / Activo Interno
    cfdi_usage: Mapped[str | None] = mapped_column(String(10))  # G01 / G03
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
    shipping_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    shipping_insurance: Mapped[float | None] = mapped_column(Numeric(14, 4))
    invoice_discount: Mapped[float | None] = mapped_column(Numeric(14, 4))
    shipping_insurance_discount: Mapped[float | None] = mapped_column(Numeric(14, 4))
    # legacy / alias combinado
    payment_type: Mapped[str | None] = mapped_column(String(80))
    # Multi-select formalizado como JSON: ["1","3","4","28","99"]
    payment_methods: Mapped[list[str] | None] = mapped_column(JSON)
    order_status: Mapped[str | None] = mapped_column(String(40), index=True)
    # Solicitada → En recolección → En Almacen
    payment_status: Mapped[str | None] = mapped_column(String(40), index=True)
    # No Pagado → Pagado
    invoice_status: Mapped[str | None] = mapped_column(String(40), index=True)
    # Sin Factura → En proceso de cancelacion → Factura Cancelada / Facturada
    subtotal: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)
    iva: Mapped[float | None] = mapped_column(
        Numeric(14, 4),
        Computed(
            "CASE "
            "WHEN subtotal IS NULL THEN NULL "
            "ELSE (subtotal + COALESCE(shipping_cost, 0)) * 0.16 "
            "END",
            persisted=True,
        ),
        nullable=True,
    )
    total: Mapped[float | None] = mapped_column(
        Numeric(14, 4),
        Computed(
            "CASE "
            "WHEN subtotal IS NULL THEN NULL "
            "ELSE (subtotal + COALESCE(shipping_cost, 0)) * 1.16 "
            "- COALESCE(invoice_discount, 0) "
            "- COALESCE(shipping_insurance_discount, 0) "
            "END",
            persisted=True,
        ),
        nullable=True,
    )
    delivered_percent: Mapped[float | None] = mapped_column(Numeric(6, 4))
    related_goods_receipts: Mapped[list[str] | None] = mapped_column(JSON)
    review_responsible: Mapped[str | None] = mapped_column(String(255))
    task_assigned: Mapped[bool | None] = mapped_column(Boolean)
    invoice_file_url: Mapped[str | None] = mapped_column(String(500))
    material_evidence_url: Mapped[str | None] = mapped_column(String(500))
    related_nonconformities: Mapped[list[str] | None] = mapped_column(JSON)
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
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

    supplier: Mapped[Supplier | None] = relationship(back_populates="purchase_invoices")
    goods_receipts: Mapped[list[GoodsReceipt]] = relationship(
        back_populates="purchase_invoice"
    )
    nonconformities: Mapped[list[NonConformity]] = relationship(
        back_populates="purchase_invoice"
    )


# ---------------------------------------------------------------------------
# Gastos Operativos RTB (17)
# ---------------------------------------------------------------------------


class OperatingExpense(Base):
    """Gastos operativos de RTB (renta, servicios, honorarios, viáticos…)."""

    __tablename__ = "gastos_operativos"
    __table_args__ = (
        CheckConstraint("total >= 0", name="ck_gastos_operativos_total_nonneg"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    concept: Mapped[str] = mapped_column(String(255), nullable=False)
    invoice_folio: Mapped[str | None] = mapped_column(String(120), index=True)
    account_card_number: Mapped[str | None] = mapped_column(String(80))
    notes: Mapped[str | None] = mapped_column(Text)
    subtotal: Mapped[float | None] = mapped_column(Numeric(14, 4))
    iva: Mapped[float | None] = mapped_column(
        Numeric(14, 4),
        Computed(
            "CASE WHEN subtotal IS NULL THEN NULL ELSE subtotal * 0.16 END",
            persisted=True,
        ),
    )
    total: Mapped[float | None] = mapped_column(
        Numeric(14, 4),
        Computed(
            "CASE WHEN subtotal IS NULL THEN NULL ELSE subtotal * 1.16 END",
            persisted=True,
        ),
    )
    spent_on: Mapped[date | None] = mapped_column(Date, index=True)
    is_deductible: Mapped[bool | None] = mapped_column(Boolean, index=True)
    category: Mapped[str | None] = mapped_column(String(80), index=True)
    # Renta/Local · Servicios · Transporte/Combustible · Mantenimiento ·
    # Honorarios · Alimentación/Viáticos · Publicidad/Marketing ·
    # Comisiones Bancarias · Otros · Software
    payment_method: Mapped[str | None] = mapped_column(String(80), index=True)
    # Efectivo · Tarjeta · Transferencia · OXXO
    status: Mapped[str | None] = mapped_column(String(40), index=True)
    # Pendiente → En Proceso → Rechazado / Realizado
    file_url: Mapped[str | None] = mapped_column(String(500))
    responsible: Mapped[str | None] = mapped_column(String(255))
    supplier_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("proveedores.id", ondelete="SET NULL"),
        index=True,
    )
    supplier_name: Mapped[str | None] = mapped_column(String(255))
    supplier_rfc: Mapped[str | None] = mapped_column(String(20))
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
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

    supplier: Mapped[Supplier | None] = relationship(
        back_populates="operating_expenses"
    )


# ---------------------------------------------------------------------------
# Pedidos de Clientes (8)
# ---------------------------------------------------------------------------


class CustomerOrder(Base):
    """Trazabilidad del ciclo de pedido después de aprobar la cotización."""

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
    # Números de documentos
    invoice_number: Mapped[str | None] = mapped_column(String(120))  # # de Factura
    delivery_note_number: Mapped[str | None] = mapped_column(String(120))  # # de NR
    payment_complement_number: Mapped[str | None] = mapped_column(String(120))
    received_by: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    # Archivos
    invoice_file_url: Mapped[str | None] = mapped_column(String(500))
    delivery_note_file_url: Mapped[str | None] = mapped_column(String(500))
    # Pago / Facturación
    payment_type: Mapped[str | None] = mapped_column(String(80))
    # Credito · Transferencia · Efectivo · Tarjeta de Debito
    payment_status: Mapped[str | None] = mapped_column(String(40), index=True)
    # No pagada → Pagada Parcial → Cancelada / Pagada Total
    invoice_status: Mapped[str | None] = mapped_column(String(40))
    # status_multi (Entregada · Cancelada · Impresa)
    invoice_status_multi: Mapped[list[str] | None] = mapped_column(JSON)
    invoice_state: Mapped[str | None] = mapped_column(String(40))
    # Estado de Factura: En espera · Facturando · Factura enviada
    order_status: Mapped[str | None] = mapped_column(String(40), index=True)
    # En espera → Preparado / Enviado → Entregado
    has_missing_items: Mapped[bool | None] = mapped_column(Boolean)
    delivery_type: Mapped[str | None] = mapped_column(String(80))
    # Fechas principales
    ordered_on: Mapped[date | None] = mapped_column(Date, index=True)
    validated_on: Mapped[date | None] = mapped_column(Date)
    approved_on: Mapped[date | None] = mapped_column(Date)
    associated_on: Mapped[date | None] = mapped_column(Date)
    shipped_on: Mapped[date | None] = mapped_column(Date)
    delivered_on: Mapped[date | None] = mapped_column(Date)
    invoiced_on: Mapped[date | None] = mapped_column(Date)
    paid_on: Mapped[date | None] = mapped_column(Date)
    # Fechas secundarias (reenvíos / correcciones)
    secondary_paid_on: Mapped[date | None] = mapped_column(Date)
    secondary_invoiced_on: Mapped[date | None] = mapped_column(Date)
    secondary_validated_on: Mapped[date | None] = mapped_column(Date)
    secondary_associated_on: Mapped[date | None] = mapped_column(Date)
    # Responsables
    fulfillment_responsible: Mapped[str | None] = mapped_column(String(255))
    fulfillment_responsible_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    # Cotización origen
    quote_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cotizaciones.id", ondelete="SET NULL"),
        index=True,
    )
    # Totales (rollup de Cotizacion)
    total: Mapped[float | None] = mapped_column(Numeric(14, 4))
    subtotal_with_shipping: Mapped[float | None] = mapped_column(Numeric(14, 4))
    # Tiempos calculados
    delivery_time_days: Mapped[int | None] = mapped_column(Integer)
    payment_time_days: Mapped[int | None] = mapped_column(Integer)
    preparation_time_days: Mapped[int | None] = mapped_column(Integer)
    packed_percent: Mapped[float | None] = mapped_column(Numeric(6, 2))
    raw_payload: Mapped[dict | None] = mapped_column(JSON)
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

    customer: Mapped[Customer | None] = relationship(back_populates="orders")
    quote: Mapped[Quote | None] = relationship(back_populates="orders")
    incomplete_orders: Mapped[list[IncompleteOrder]] = relationship(
        back_populates="customer_order"
    )
    nonconformities: Mapped[list[NonConformity]] = relationship(
        back_populates="customer_order"
    )
    date_verifications: Mapped[list[OrderDateVerification]] = relationship(
        back_populates="customer_order"
    )


# ---------------------------------------------------------------------------
# Pedidos Incompletos (9)
# ---------------------------------------------------------------------------


class IncompleteOrder(Base):
    """Pedidos con faltantes, motivo, responsable y fecha estimada de resolución."""

    __tablename__ = "pedidos_incompletos"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    name: Mapped[str | None] = mapped_column(
        String(255), index=True
    )  # Nombre del Pedido
    additional_notes: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str | None] = mapped_column(String(20), index=True)
    # Alta · Media · Baja
    reason: Mapped[str | None] = mapped_column(String(80))
    # Motivo de Incompletitud: Falta de inventario · Pago pendiente ·
    # Problema de envío · Error en dirección · Producto dañado ·
    # Cancelación parcial · Pedido en revisión · Documentación incompleta ·
    # Envío · Proveedor
    status: Mapped[str | None] = mapped_column(String(40), index=True)
    # Pendiente → En proceso / Esperando inventario /
    # Esperando pago / Listo para enviar → Enviado / Completado
    estimated_resolution_on: Mapped[date | None] = mapped_column(Date)
    aging_days: Mapped[int | None] = mapped_column(Integer)
    responsible: Mapped[str | None] = mapped_column(String(255))
    responsible_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    customer_order_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("pedidos_clientes.id", ondelete="SET NULL"),
        index=True,
    )
    quote_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cotizaciones.id", ondelete="SET NULL"),
        index=True,
    )
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="SET NULL"),
        index=True,
    )
    # Rollup cacheado
    customer_final_id: Mapped[str | None] = mapped_column(String(80))
    missing_products: Mapped[int | None] = mapped_column(Integer)
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

    customer_order: Mapped[CustomerOrder | None] = relationship(
        back_populates="incomplete_orders"
    )
    quote: Mapped[Quote | None] = relationship(back_populates="incomplete_orders")
    product: Mapped[Product | None] = relationship(back_populates="incomplete_orders")


# ---------------------------------------------------------------------------
# Verificador de fechas pedidos (16)
# ---------------------------------------------------------------------------


class OrderDateVerification(Base):
    """Bitácora automática de cambios de fecha en pedidos/cotizaciones."""

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
    event_type: Mapped[str | None] = mapped_column(String(40), index=True)
    # Envío · Entrega · Aprobación · Asociacion · Validación ·
    # Facturación · Pago · Asociación Secundaria
    event_date: Mapped[date | None] = mapped_column(Date, index=True)
    event_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    triggered_by: Mapped[str | None] = mapped_column(String(255))
    triggered_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("clientes.id", ondelete="SET NULL"),
        index=True,
    )
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

    customer_order: Mapped[CustomerOrder | None] = relationship(
        back_populates="date_verifications"
    )
    customer: Mapped[Customer | None] = relationship(
        back_populates="date_verifications"
    )
    quote: Mapped[Quote | None] = relationship(back_populates="date_verifications")


# ---------------------------------------------------------------------------
# Auditoría de cargas CSV (infraestructura n8n)
# ---------------------------------------------------------------------------


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

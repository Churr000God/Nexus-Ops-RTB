"""Modelos SQLAlchemy para el módulo Productos & Pricing.

Separados en este archivo para no recargar ops_models.py.
Importados y re-exportados desde models/__init__.py.

Tablas:
  - sat_product_keys, sat_unit_keys  — catálogos SAT CFDI 4.0
  - product_attributes, product_attribute_options — configurabilidad
  - product_configurations           — instancias de producto configurado
  - bom, bom_items                   — lista de materiales (BOM)
  - customer_contract_prices         — convenios Ariba
  - product_cost_history             — bitácora inmutable de costo promedio
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


# ---------------------------------------------------------------------------
# Catálogos SAT (CFDI 4.0)
# ---------------------------------------------------------------------------


class SATProductKey(Base):
    """Catálogo de claves de producto SAT para CFDI 4.0."""

    __tablename__ = "sat_product_keys"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    code: Mapped[str] = mapped_column(String(8), nullable=False, unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class SATUnitKey(Base):
    """Catálogo de claves de unidad SAT para CFDI 4.0."""

    __tablename__ = "sat_unit_keys"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    code: Mapped[str] = mapped_column(String(6), nullable=False, unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


# ---------------------------------------------------------------------------
# Productos configurables: atributos y opciones
# ---------------------------------------------------------------------------


class ProductAttribute(Base):
    """Atributos configurables de un producto (voltaje, color, capacidad, etc.)."""

    __tablename__ = "product_attributes"
    __table_args__ = (
        UniqueConstraint("product_id", "name", name="uq_product_attributes_product_name"),
        CheckConstraint(
            "data_type IN ('TEXT','NUMBER','BOOLEAN','OPTION')",
            name="ck_product_attributes_data_type",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    product_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    data_type: Mapped[str] = mapped_column(String(10), nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)

    options: Mapped[list[ProductAttributeOption]] = relationship(
        back_populates="attribute", cascade="all, delete-orphan"
    )


class ProductAttributeOption(Base):
    """Valores predefinidos para atributos de tipo OPTION (con sobrecosto opcional)."""

    __tablename__ = "product_attribute_options"
    __table_args__ = (
        UniqueConstraint(
            "attribute_id", "value", name="uq_product_attribute_options_attr_value"
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    attribute_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("product_attributes.id", ondelete="CASCADE"),
        nullable=False,
    )
    value: Mapped[str] = mapped_column(Text, nullable=False)
    extra_cost: Mapped[float] = mapped_column(Numeric(14, 4), default=0, nullable=False)

    attribute: Mapped[ProductAttribute] = relationship(back_populates="options")


# ---------------------------------------------------------------------------
# Producto configurado (instancia de configuración cotizada)
# ---------------------------------------------------------------------------


class ProductConfiguration(Base):
    """Instancia de configuración concreta: producto base + valores de atributos en JSONB.

    config_hash = MD5 del JSONB normalizado (ordenado por clave).
    Si dos cotizaciones piden la misma combinación, reutilizan el mismo registro.
    """

    __tablename__ = "product_configurations"
    __table_args__ = (
        UniqueConstraint(
            "product_id", "config_hash", name="uq_product_configurations_product_hash"
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    product_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    config_sku: Mapped[str | None] = mapped_column(Text, unique=True)
    config_hash: Mapped[str] = mapped_column(Text, nullable=False)
    attributes: Mapped[dict] = mapped_column(JSONB, nullable=False)
    additional_cost: Mapped[float] = mapped_column(Numeric(14, 4), default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# BOM (Lista de Materiales)
# ---------------------------------------------------------------------------


class BOM(Base):
    """Lista de materiales de un producto ensamblado (versionada).

    Solo una versión activa por producto (is_active=True).
    Las versiones anteriores se conservan para trazabilidad histórica.
    """

    __tablename__ = "bom"
    __table_args__ = (
        UniqueConstraint("product_id", "version", name="uq_bom_product_version"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    product_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    items: Mapped[list[BOMItem]] = relationship(
        back_populates="bom", cascade="all, delete-orphan"
    )


class BOMItem(Base):
    """Componente dentro de un BOM. component_id apunta a otro producto (recursivo)."""

    __tablename__ = "bom_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_bom_items_qty_positive"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    bom_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("bom.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    component_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id"),
        nullable=False,
    )
    quantity: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    bom: Mapped[BOM] = relationship(back_populates="items")


# ---------------------------------------------------------------------------
# Convenios de precio fijo (Ariba)
# ---------------------------------------------------------------------------


class CustomerContractPrice(Base):
    """Precio fijo acordado con un cliente específico por producto (convenio Ariba).

    Reglas operativas:
    - Solo roles ACCOUNTING o ADMIN pueden modificar.
    - Cambiar precio: cerrar vigente (is_current=False, valid_to=hoy-1) + nuevo registro.
    - last_change_notice es obligatorio al cambiar fixed_sale_price.
    - fn_get_quote_pricing() tiene prioridad sobre cualquier cálculo de margen.
    """

    __tablename__ = "customer_contract_prices"
    __table_args__ = (
        CheckConstraint(
            "contract_type IN ('ARIBA','CONTRACT_OTHER')",
            name="ck_customer_contract_prices_type",
        ),
        CheckConstraint(
            "fixed_sale_price >= 0",
            name="ck_customer_contract_prices_price_positive",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    customer_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("clientes.id"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id"),
        nullable=False,
        index=True,
    )
    contract_type: Mapped[str] = mapped_column(
        String(20), default="ARIBA", nullable=False
    )
    fixed_sale_price: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="MXN", nullable=False)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date | None] = mapped_column(Date)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_change_notice: Mapped[str | None] = mapped_column(Text)
    last_changed_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
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


# ---------------------------------------------------------------------------
# Histórico de costo promedio (bitácora inmutable)
# ---------------------------------------------------------------------------


class ProductCostHistory(Base):
    """Bitácora inmutable de cada cambio en productos.current_avg_cost.

    Permite responder: '¿cuál era el costo promedio del SKU X al aprobarse
    la cotización N?'  No se audita en audit_log — ya es bitácora por sí misma.
    """

    __tablename__ = "product_cost_history"
    __table_args__ = (
        CheckConstraint(
            "triggered_by IN ('GOODS_RECEIPT','OPENING_BALANCE','MANUAL_RECALC','NIGHTLY_REFRESH')",
            name="ck_product_cost_history_triggered_by",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    product_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    previous_avg_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    new_avg_cost: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    quantity_received: Mapped[float | None] = mapped_column(Numeric(14, 4))
    unit_cost_of_receipt: Mapped[float | None] = mapped_column(Numeric(14, 4))
    triggered_by: Mapped[str] = mapped_column(String(20), nullable=False)
    source_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True))
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

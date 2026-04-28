"""Modelos SQLAlchemy para el módulo Clientes y Proveedores.

Tablas:
  - customers, customer_tax_data, customer_addresses, customer_contacts
  - suppliers, supplier_tax_data, supplier_addresses, supplier_contacts
  - supplier_products (catálogo con histórico de precios)

Los PKs son BIGINT GENERATED ALWAYS AS IDENTITY, igual que las tablas de
seguridad/RBAC.  La extensión citext debe estar activa en la BD para que
las columnas `rfc` sean case-insensitive a nivel motor.

Nombres de clase para evitar colisión con los modelos legacy (ops_models):
  - CustomerMaster  → tabla `customers`
  - SupplierMaster  → tabla `suppliers`
  - SupplierProductListing → tabla `supplier_products`
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
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import UserDefinedType

from app.models.base import Base


class CIText(UserDefinedType):
    """PostgreSQL citext — case-insensitive text.

    SQLAlchemy trata la columna como Text a nivel Python; la BD se encarga
    de la comparación sin distinción de mayúsculas/minúsculas.
    """

    cache_ok = True

    def get_col_spec(self, **kw: object) -> str:
        return "CITEXT"


# ---------------------------------------------------------------------------
# SAT catálogos auxiliares (creados en migración 0014)
# ---------------------------------------------------------------------------


class SATTaxRegime(Base):
    """Catálogo de regímenes fiscales SAT (601 General de Ley, 612 PF, etc.)."""

    __tablename__ = "sat_tax_regimes"

    regime_id: Mapped[int] = mapped_column(
        SmallInteger, Identity(always=True), primary_key=True
    )
    code: Mapped[str] = mapped_column(String(10), nullable=False, unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    applies_to: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="BOTH"
    )

    customer_tax_data: Mapped[list[CustomerTaxData]] = relationship(
        back_populates="tax_regime"
    )


class SATCfdiUse(Base):
    """Catálogo de usos de CFDI SAT (G01, G03, I08, S01…)."""

    __tablename__ = "sat_cfdi_uses"

    use_id: Mapped[str] = mapped_column(String(10), primary_key=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    applies_to: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="BOTH"
    )

    customer_tax_data: Mapped[list[CustomerTaxData]] = relationship(
        back_populates="cfdi_use"
    )


# ---------------------------------------------------------------------------
# Clientes
# ---------------------------------------------------------------------------


class CustomerMaster(Base):
    """Cabecera comercial del cliente (datos de negocio, no fiscales).

    Un cliente puede tener varias razones sociales (customer_tax_data) y
    varias direcciones (customer_addresses).  Los datos fiscales SAT exactos
    viven en customer_tax_data para soportar clientes multi-sucursal.
    """

    __tablename__ = "customers"
    __table_args__ = (
        CheckConstraint(
            "customer_type IN ('COMPANY','PERSON')",
            name="ck_customers_customer_type",
        ),
        CheckConstraint(
            "locality IN ('LOCAL','FOREIGN')",
            name="ck_customers_locality",
        ),
    )

    customer_id: Mapped[int] = mapped_column(
        BigInteger, Identity(always=True), primary_key=True
    )
    code: Mapped[str] = mapped_column(Text, nullable=False, unique=True, index=True)
    business_name: Mapped[str] = mapped_column(Text, nullable=False)
    customer_type: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="COMPANY"
    )
    locality: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="LOCAL"
    )
    payment_terms_days: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0"
    )
    credit_limit: Mapped[float | None] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, server_default="MXN"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    tax_data: Mapped[list[CustomerTaxData]] = relationship(
        back_populates="customer", cascade="all, delete-orphan"
    )
    addresses: Mapped[list[CustomerAddress]] = relationship(
        back_populates="customer", cascade="all, delete-orphan"
    )
    contacts: Mapped[list[CustomerContact]] = relationship(
        back_populates="customer", cascade="all, delete-orphan"
    )


class CustomerTaxData(Base):
    """Datos fiscales SAT de un cliente.

    Un cliente puede tener N razones sociales con RFCs distintos
    (ej. Femsa tiene Coca-Cola Femsa, Femsa Comercio, Femsa Logística).
    Cada CFDI se emite a una de ellas.
    """

    __tablename__ = "customer_tax_data"
    __table_args__ = (
        UniqueConstraint("customer_id", "rfc", name="uq_customer_tax_data_customer_rfc"),
    )

    tax_data_id: Mapped[int] = mapped_column(
        BigInteger, Identity(always=True), primary_key=True
    )
    customer_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("customers.customer_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rfc: Mapped[str] = mapped_column(CIText, nullable=False)
    legal_name: Mapped[str] = mapped_column(Text, nullable=False)
    # FK a sat_tax_regimes; nullable para no bloquear si el catálogo está vacío
    tax_regime_id: Mapped[int | None] = mapped_column(
        SmallInteger,
        ForeignKey("sat_tax_regimes.regime_id", ondelete="SET NULL"),
        nullable=True,
    )
    # FK a sat_cfdi_uses; nullable ídem
    cfdi_use_id: Mapped[str | None] = mapped_column(
        String(10),
        ForeignKey("sat_cfdi_uses.use_id", ondelete="SET NULL"),
        nullable=True,
    )
    zip_code: Mapped[str] = mapped_column(String(10), nullable=False)
    is_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )

    customer: Mapped[CustomerMaster] = relationship(back_populates="tax_data")
    tax_regime: Mapped[SATTaxRegime | None] = relationship(
        back_populates="customer_tax_data"
    )
    cfdi_use: Mapped[SATCfdiUse | None] = relationship(
        back_populates="customer_tax_data"
    )
    addresses: Mapped[list[CustomerAddress]] = relationship(
        back_populates="tax_data_ref"
    )


class CustomerAddress(Base):
    """Direcciones de un cliente: FISCAL (ligada a RFC), DELIVERY u OTHER.

    Regla invariante (CHECK constraint en BD):
      - FISCAL  → tax_data_id IS NOT NULL
      - DELIVERY / OTHER → tax_data_id IS NULL
    """

    __tablename__ = "customer_addresses"
    __table_args__ = (
        CheckConstraint(
            "address_type IN ('FISCAL','DELIVERY','OTHER')",
            name="ck_customer_addresses_address_type",
        ),
        CheckConstraint(
            "(address_type = 'FISCAL' AND tax_data_id IS NOT NULL)"
            " OR (address_type <> 'FISCAL' AND tax_data_id IS NULL)",
            name="ck_customer_addresses_fiscal_tax_data",
        ),
    )

    address_id: Mapped[int] = mapped_column(
        BigInteger, Identity(always=True), primary_key=True
    )
    customer_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("customers.customer_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    address_type: Mapped[str] = mapped_column(String(10), nullable=False)
    tax_data_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("customer_tax_data.tax_data_id", ondelete="SET NULL"),
        nullable=True,
    )
    label: Mapped[str | None] = mapped_column(Text)
    street: Mapped[str] = mapped_column(Text, nullable=False)
    exterior_number: Mapped[str | None] = mapped_column(Text)
    interior_number: Mapped[str | None] = mapped_column(Text)
    neighborhood: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(Text)
    state: Mapped[str | None] = mapped_column(Text)
    country: Mapped[str] = mapped_column(
        Text, nullable=False, server_default="México"
    )
    zip_code: Mapped[str | None] = mapped_column(String(10))
    is_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    customer: Mapped[CustomerMaster] = relationship(back_populates="addresses")
    tax_data_ref: Mapped[CustomerTaxData | None] = relationship(
        back_populates="addresses"
    )


class CustomerContact(Base):
    """Personas de contacto en un cliente (comprador, tesorería, técnico…)."""

    __tablename__ = "customer_contacts"

    contact_id: Mapped[int] = mapped_column(
        BigInteger, Identity(always=True), primary_key=True
    )
    customer_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("customers.customer_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    role_title: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(CIText)
    phone: Mapped[str | None] = mapped_column(Text)
    is_primary: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    customer: Mapped[CustomerMaster] = relationship(back_populates="contacts")


# ---------------------------------------------------------------------------
# Proveedores
# ---------------------------------------------------------------------------


class SupplierMaster(Base):
    """Cabecera comercial del proveedor.

    is_occasional=True: compra única o esporádica — ficha mínima, no se
    mantiene catálogo de productos ni se sugiere en futuras compras.
    avg_payment_time_days: TPP — días reales en que RTB le paga (KPI propio).
    """

    __tablename__ = "suppliers"
    __table_args__ = (
        CheckConstraint(
            "supplier_type IN ('GOODS','SERVICES','BOTH')",
            name="ck_suppliers_supplier_type",
        ),
        CheckConstraint(
            "locality IN ('LOCAL','FOREIGN')",
            name="ck_suppliers_locality",
        ),
    )

    supplier_id: Mapped[int] = mapped_column(
        BigInteger, Identity(always=True), primary_key=True
    )
    code: Mapped[str] = mapped_column(Text, nullable=False, unique=True, index=True)
    business_name: Mapped[str] = mapped_column(Text, nullable=False)
    supplier_type: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="GOODS"
    )
    locality: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="LOCAL"
    )
    is_occasional: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    payment_terms_days: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0"
    )
    avg_payment_time_days: Mapped[int | None] = mapped_column(SmallInteger)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, server_default="MXN"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    tax_data: Mapped[list[SupplierTaxData]] = relationship(
        back_populates="supplier", cascade="all, delete-orphan"
    )
    addresses: Mapped[list[SupplierAddress]] = relationship(
        back_populates="supplier", cascade="all, delete-orphan"
    )
    contacts: Mapped[list[SupplierContact]] = relationship(
        back_populates="supplier", cascade="all, delete-orphan"
    )
    product_listings: Mapped[list[SupplierProductListing]] = relationship(
        back_populates="supplier", cascade="all, delete-orphan"
    )


class SupplierTaxData(Base):
    """Datos fiscales SAT del proveedor.

    Sin cfdi_use_id: cuando RTB recibe factura del proveedor, él decide su
    uso CFDI — ese dato va en el CFDI entrante, no en el maestro.
    """

    __tablename__ = "supplier_tax_data"
    __table_args__ = (
        UniqueConstraint("supplier_id", "rfc", name="uq_supplier_tax_data_supplier_rfc"),
    )

    tax_data_id: Mapped[int] = mapped_column(
        BigInteger, Identity(always=True), primary_key=True
    )
    supplier_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("suppliers.supplier_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rfc: Mapped[str] = mapped_column(CIText, nullable=False)
    legal_name: Mapped[str] = mapped_column(Text, nullable=False)
    tax_regime_id: Mapped[int | None] = mapped_column(
        SmallInteger,
        ForeignKey("sat_tax_regimes.regime_id", ondelete="SET NULL"),
        nullable=True,
    )
    zip_code: Mapped[str] = mapped_column(String(10), nullable=False)
    is_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )

    supplier: Mapped[SupplierMaster] = relationship(back_populates="tax_data")
    addresses: Mapped[list[SupplierAddress]] = relationship(
        back_populates="tax_data_ref"
    )


class SupplierAddress(Base):
    """Direcciones del proveedor: FISCAL, PICKUP (donde RTB recoge) u OTHER."""

    __tablename__ = "supplier_addresses"
    __table_args__ = (
        CheckConstraint(
            "address_type IN ('FISCAL','PICKUP','OTHER')",
            name="ck_supplier_addresses_address_type",
        ),
        CheckConstraint(
            "(address_type = 'FISCAL' AND tax_data_id IS NOT NULL)"
            " OR (address_type <> 'FISCAL' AND tax_data_id IS NULL)",
            name="ck_supplier_addresses_fiscal_tax_data",
        ),
    )

    address_id: Mapped[int] = mapped_column(
        BigInteger, Identity(always=True), primary_key=True
    )
    supplier_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("suppliers.supplier_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    address_type: Mapped[str] = mapped_column(String(10), nullable=False)
    tax_data_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("supplier_tax_data.tax_data_id", ondelete="SET NULL"),
        nullable=True,
    )
    label: Mapped[str | None] = mapped_column(Text)
    street: Mapped[str] = mapped_column(Text, nullable=False)
    exterior_number: Mapped[str | None] = mapped_column(Text)
    interior_number: Mapped[str | None] = mapped_column(Text)
    neighborhood: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(Text)
    state: Mapped[str | None] = mapped_column(Text)
    country: Mapped[str] = mapped_column(
        Text, nullable=False, server_default="México"
    )
    zip_code: Mapped[str | None] = mapped_column(String(10))
    is_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    supplier: Mapped[SupplierMaster] = relationship(back_populates="addresses")
    tax_data_ref: Mapped[SupplierTaxData | None] = relationship(
        back_populates="addresses"
    )


class SupplierContact(Base):
    """Personas de contacto de un proveedor."""

    __tablename__ = "supplier_contacts"

    contact_id: Mapped[int] = mapped_column(
        BigInteger, Identity(always=True), primary_key=True
    )
    supplier_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("suppliers.supplier_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    role_title: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(CIText)
    phone: Mapped[str | None] = mapped_column(Text)
    is_primary: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    supplier: Mapped[SupplierMaster] = relationship(back_populates="contacts")


class SupplierProductListing(Base):
    """Catálogo de productos que un proveedor vende, con histórico de precios.

    Patrón de precio histórico (nunca sobreescribir):
      1. UPDATE SET valid_to = hoy-1, is_current = FALSE  (cierra el vigente)
      2. INSERT nuevo registro con is_current = TRUE        (abre el nuevo)
    Así es posible responder '¿qué precio tenía Festo para CIL-FE-50 en enero?'
    """

    __tablename__ = "supplier_products"
    __table_args__ = (
        CheckConstraint("unit_cost >= 0", name="ck_supplier_products_unit_cost_nonneg"),
    )

    supplier_product_id: Mapped[int] = mapped_column(
        BigInteger, Identity(always=True), primary_key=True
    )
    supplier_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("suppliers.supplier_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Referencia al catálogo de productos existente (UUID PK en tabla `productos`)
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    supplier_sku: Mapped[str | None] = mapped_column(Text)
    unit_cost: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, server_default="MXN"
    )
    lead_time_days: Mapped[int | None] = mapped_column(SmallInteger)
    moq: Mapped[float | None] = mapped_column(Numeric(14, 4))
    is_available: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    is_preferred: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    valid_from: Mapped[date] = mapped_column(
        Date, nullable=False, server_default="CURRENT_DATE"
    )
    valid_to: Mapped[date | None] = mapped_column(Date)
    is_current: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true", index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    supplier: Mapped[SupplierMaster] = relationship(back_populates="product_listings")

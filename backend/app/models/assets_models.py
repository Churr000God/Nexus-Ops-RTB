"""Modelos SQLAlchemy para el módulo de Assets (Equipos físicos con componentes)
y snapshots mensuales de inventario.

Tablas:
  - inventory_snapshots    — cierres mensuales inmutables de stock por SKU
  - assets                 — equipos físicos individuales
  - asset_components       — partes actualmente instaladas (estado actual, mutable)
  - asset_component_history — log inmutable de instalaciones y removidos

No Conformes extendido (columnas nc_source y asset_id) vive en ops_models.NonConformity;
los campos nuevos son accesibles desde el ORM sin clase adicional.
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
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class InventorySnapshot(Base):
    """Cierre mensual inmutable de stock por SKU.

    Generado automáticamente por fn_close_monthly_snapshot vía pg_cron
    el último día de cada mes a las 23:00. Es idempotente.
    """

    __tablename__ = "inventory_snapshots"
    __table_args__ = (
        UniqueConstraint("product_id", "snapshot_date", name="uq_inventory_snapshots_product_date"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("productos.id", ondelete="SET NULL"), nullable=True, index=True
    )
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    quantity_on_hand: Mapped[float | None] = mapped_column(Numeric(14, 4))
    avg_unit_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    total_value: Mapped[float | None] = mapped_column(Numeric(14, 4))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class Asset(Base):
    """Equipo físico individual con identidad propia (PC-001, MAQ-PR-002…).

    A diferencia de un producto en stock, cada Asset es único y persiste en el
    tiempo aunque sus componentes cambien. El historial de cambios vive en
    AssetComponentHistory.
    """

    __tablename__ = "assets"
    __table_args__ = (
        CheckConstraint(
            "asset_type IN ('COMPUTER','LAPTOP','PRINTER','MACHINE','VEHICLE','TOOL','OTHER')",
            name="ck_assets_type",
        ),
        CheckConstraint(
            "status IN ('ACTIVE','IN_REPAIR','IDLE','RETIRED','DISMANTLED')",
            name="ck_assets_status",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    asset_code: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    asset_type: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    base_product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("productos.id", ondelete="SET NULL"), nullable=True, index=True
    )
    serial_number: Mapped[str | None] = mapped_column(String(120))
    manufacturer: Mapped[str | None] = mapped_column(String(120))
    model: Mapped[str | None] = mapped_column(String(120))
    location: Mapped[str | None] = mapped_column(String(120))
    assigned_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    purchase_date: Mapped[date | None] = mapped_column(Date)
    purchase_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    warranty_until: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    retired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    retirement_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    salvage_value: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)
    retired_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    parent_asset_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True, index=True
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

    components: Mapped[list[AssetComponent]] = relationship(
        back_populates="asset", cascade="all, delete-orphan"
    )
    history: Mapped[list[AssetComponentHistory]] = relationship(
        back_populates="asset", cascade="all, delete-orphan"
    )
    children: Mapped[list[Asset]] = relationship(
        "Asset",
        foreign_keys="Asset.parent_asset_id",
        back_populates="parent",
        lazy="select",
    )
    parent: Mapped[Asset | None] = relationship(
        "Asset",
        foreign_keys="Asset.parent_asset_id",
        back_populates="children",
        remote_side="Asset.id",
        lazy="select",
    )


class AssetComponent(Base):
    """Partes actualmente instaladas en un equipo (estado actual, mutable).

    Cuando se instala una pieza, el trigger fn_on_component_install crea
    automáticamente el movimiento ISSUE en inventory_movements y la entrada
    en asset_component_history.
    """

    __tablename__ = "asset_components"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    asset_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("productos.id", ondelete="SET NULL"), nullable=True, index=True
    )
    quantity: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=1)
    serial_number: Mapped[str | None] = mapped_column(String(120))
    installed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    installed_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text)

    asset: Mapped[Asset] = relationship(back_populates="components")


class AssetComponentHistory(Base):
    """Log inmutable de instalaciones y removidos por equipo.

    Nunca se elimina. Permite responder: ¿qué piezas se han cambiado
    a este equipo en el último año?
    """

    __tablename__ = "asset_component_history"
    __table_args__ = (
        CheckConstraint(
            "operation IN ('INSTALL','REMOVE','REPLACE')",
            name="ck_asset_component_history_operation",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    asset_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("productos.id", ondelete="SET NULL"), nullable=True, index=True
    )
    operation: Mapped[str] = mapped_column(String(10), nullable=False)
    quantity: Mapped[float | None] = mapped_column(Numeric(14, 4))
    serial_number: Mapped[str | None] = mapped_column(String(120))
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    inventory_movement_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("inventory_movements.id", ondelete="SET NULL"),
        nullable=True,
    )
    nc_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("no_conformes.id", ondelete="SET NULL"),
        nullable=True,
    )
    reason: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    asset: Mapped[Asset] = relationship(back_populates="history")


class PhysicalCount(Base):
    """Sesión de conteo físico de activos.

    Contiene un snapshot de todos los activos relevantes en el momento
    de crear el conteo. Las líneas se marcan found/not-found durante
    el recorrido físico y se confirman al cerrar la sesión.
    """

    __tablename__ = "physical_counts"
    __table_args__ = (
        CheckConstraint(
            "status IN ('DRAFT','CONFIRMED','CANCELLED')",
            name="ck_physical_counts_status",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    count_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    location_filter: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT", index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    lines: Mapped[list[PhysicalCountLine]] = relationship(
        back_populates="count", cascade="all, delete-orphan"
    )


class PhysicalCountLine(Base):
    """Línea de conteo físico — un activo dentro de una sesión de conteo."""

    __tablename__ = "physical_count_lines"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    count_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("physical_counts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    asset_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    asset_code: Mapped[str] = mapped_column(String(80), nullable=False)
    asset_name: Mapped[str] = mapped_column(Text, nullable=False)
    expected_location: Mapped[str | None] = mapped_column(Text)
    scanned_location: Mapped[str | None] = mapped_column(Text)
    found: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text)

    count: Mapped[PhysicalCount] = relationship(back_populates="lines")


class AssetAssignmentHistory(Base):
    """Serie de tiempo de asignaciones de un equipo.

    Cada vez que el activo cambia de usuario asignado (o se desasigna)
    se inserta una fila. La fila actual es la de mayor assigned_at.
    """

    __tablename__ = "asset_assignment_history"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    asset_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    location: Mapped[str | None] = mapped_column(Text)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    assigned_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text)

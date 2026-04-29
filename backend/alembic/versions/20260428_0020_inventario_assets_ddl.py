"""inventario_assets: DDL nuevas tablas

Cambios:
  1. inventory_snapshots  — cierres mensuales inmutables de stock por SKU
  2. assets               — equipos físicos individuales
  3. asset_components     — partes actualmente instaladas en cada equipo
  4. asset_component_history — log inmutable de instalaciones y removidos
  5. ADD COLUMN no_conformes.nc_source (origen del no conforme)
  6. ADD COLUMN no_conformes.asset_id  (FK a assets cuando aplica)

Revision ID: 20260428_0020
Revises: 20260428_0019
Create Date: 2026-04-28
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PGUUID

revision: str = "20260428_0020"
down_revision: str = "20260428_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1. inventory_snapshots ──────────────────────────────────────────────────
    op.create_table(
        "inventory_snapshots",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("product_id", PGUUID(as_uuid=True), sa.ForeignKey("productos.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("snapshot_date", sa.Date, nullable=False, index=True),
        sa.Column("quantity_on_hand", sa.Numeric(14, 4), nullable=True),
        sa.Column("avg_unit_cost", sa.Numeric(14, 4), nullable=True),
        sa.Column("total_value", sa.Numeric(14, 4), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("product_id", "snapshot_date", name="uq_inventory_snapshots_product_date"),
    )

    # ── 2. assets ───────────────────────────────────────────────────────────────
    # Equipos físicos individuales con identidad propia (PC-001, MAQ-PR-002, etc.)
    op.create_table(
        "assets",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("asset_code", sa.String(80), unique=True, nullable=False, index=True),
        sa.Column(
            "asset_type",
            sa.String(20),
            nullable=False,
            # COMPUTER, LAPTOP, PRINTER, MACHINE, VEHICLE, TOOL, OTHER
        ),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column(
            "base_product_id",
            PGUUID(as_uuid=True),
            sa.ForeignKey("productos.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("serial_number", sa.String(120), nullable=True),
        sa.Column("manufacturer", sa.String(120), nullable=True),
        sa.Column("model", sa.String(120), nullable=True),
        sa.Column("location", sa.String(120), nullable=True),
        sa.Column(
            "assigned_user_id",
            PGUUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="ACTIVE",
            # ACTIVE, IN_REPAIR, IDLE, RETIRED, DISMANTLED
        ),
        sa.Column("purchase_date", sa.Date, nullable=True),
        sa.Column("purchase_cost", sa.Numeric(14, 4), nullable=True),
        sa.Column("warranty_until", sa.Date, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "asset_type IN ('COMPUTER','LAPTOP','PRINTER','MACHINE','VEHICLE','TOOL','OTHER')",
            name="ck_assets_type",
        ),
        sa.CheckConstraint(
            "status IN ('ACTIVE','IN_REPAIR','IDLE','RETIRED','DISMANTLED')",
            name="ck_assets_status",
        ),
    )

    # ── 3. asset_components ─────────────────────────────────────────────────────
    # Partes que tiene cada equipo AHORA (estado actual, mutable).
    op.create_table(
        "asset_components",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "asset_id",
            PGUUID(as_uuid=True),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "product_id",
            PGUUID(as_uuid=True),
            sa.ForeignKey("productos.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("quantity", sa.Numeric(14, 4), nullable=False, server_default="1"),
        sa.Column("serial_number", sa.String(120), nullable=True),
        sa.Column("installed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column(
            "installed_by",
            PGUUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("notes", sa.Text, nullable=True),
    )

    # ── 4. asset_component_history ──────────────────────────────────────────────
    # Log inmutable de instalaciones y removidos (nunca se borra).
    op.create_table(
        "asset_component_history",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "asset_id",
            PGUUID(as_uuid=True),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "product_id",
            PGUUID(as_uuid=True),
            sa.ForeignKey("productos.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "operation",
            sa.String(10),
            nullable=False,
            # INSTALL, REMOVE, REPLACE
        ),
        sa.Column("quantity", sa.Numeric(14, 4), nullable=True),
        sa.Column("serial_number", sa.String(120), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False, index=True),
        sa.Column(
            "user_id",
            PGUUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "inventory_movement_id",
            PGUUID(as_uuid=True),
            sa.ForeignKey("inventory_movements.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "nc_id",
            PGUUID(as_uuid=True),
            sa.ForeignKey("no_conformes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.CheckConstraint(
            "operation IN ('INSTALL','REMOVE','REPLACE')",
            name="ck_asset_component_history_operation",
        ),
    )

    # ── 5. ADD COLUMN no_conformes.nc_source ────────────────────────────────────
    # Distingue el origen del no conforme.
    op.add_column(
        "no_conformes",
        sa.Column(
            "nc_source",
            sa.String(20),
            nullable=False,
            server_default="SUPPLIER",
            # SUPPLIER, CUSTOMER_RETURN, ASSET_REMOVAL, PHYSICAL_COUNT, OTHER
        ),
    )
    op.execute("""
        ALTER TABLE no_conformes
        ADD CONSTRAINT ck_no_conformes_nc_source
        CHECK (nc_source IN ('SUPPLIER','CUSTOMER_RETURN','ASSET_REMOVAL','PHYSICAL_COUNT','OTHER'))
    """)

    # ── 6. ADD COLUMN no_conformes.asset_id ─────────────────────────────────────
    # Apunta al equipo origen cuando nc_source = 'ASSET_REMOVAL'.
    op.add_column(
        "no_conformes",
        sa.Column(
            "asset_id",
            PGUUID(as_uuid=True),
            sa.ForeignKey("assets.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("no_conformes", "asset_id")
    op.execute("ALTER TABLE no_conformes DROP CONSTRAINT IF EXISTS ck_no_conformes_nc_source")
    op.drop_column("no_conformes", "nc_source")
    op.drop_table("asset_component_history")
    op.drop_table("asset_components")
    op.drop_table("assets")
    op.drop_table("inventory_snapshots")

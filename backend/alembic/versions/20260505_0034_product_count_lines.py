"""product_count_lines — conteo físico de productos con cantidades

Revision ID: 20260505_0034
Revises: 20260430_0033
Create Date: 2026-05-05
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260505_0034"
down_revision = "20260430_0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. count_type en physical_counts
    op.add_column(
        "physical_counts",
        sa.Column("count_type", sa.String(10), server_default="ASSET", nullable=False),
    )
    op.create_check_constraint(
        "ck_physical_counts_count_type",
        "physical_counts",
        "count_type IN ('ASSET','PRODUCT')",
    )

    # 2. updated_by / updated_at en physical_count_lines (activos)
    op.add_column(
        "physical_count_lines",
        sa.Column(
            "updated_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "physical_count_lines",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 3. Tabla product_count_lines
    op.create_table(
        "product_count_lines",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "count_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("physical_counts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("productos.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("sku", sa.String(120), nullable=True),
        sa.Column("product_name", sa.String(500), nullable=False),
        sa.Column("is_saleable", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("category", sa.String(200), nullable=True),
        sa.Column("theoretical_qty", sa.Numeric(14, 4), nullable=True),
        sa.Column("real_qty", sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("counted_qty", sa.Numeric(14, 4), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "updated_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("product_count_lines")
    op.drop_column("physical_count_lines", "updated_at")
    op.drop_column("physical_count_lines", "updated_by")
    op.drop_constraint("ck_physical_counts_count_type", "physical_counts", type_="check")
    op.drop_column("physical_counts", "count_type")

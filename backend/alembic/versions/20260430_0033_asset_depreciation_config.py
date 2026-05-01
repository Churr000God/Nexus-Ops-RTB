"""asset_depreciation_config — configuración de depreciación por activo

Revision ID: 20260430_0033
Revises: 20260430_0032
Create Date: 2026-04-30
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PGUUID

revision = "20260430_0033"
down_revision = "20260430_0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "asset_depreciation_config",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "asset_id",
            PGUUID(as_uuid=True),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("method", sa.String(20), nullable=False, server_default="STRAIGHT_LINE"),
        sa.Column("useful_life_years", sa.Integer(), nullable=False),
        sa.Column("residual_value", sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("method IN ('STRAIGHT_LINE')", name="ck_depreciation_method"),
        sa.CheckConstraint("useful_life_years > 0", name="ck_depreciation_life_positive"),
        sa.CheckConstraint("residual_value >= 0", name="ck_depreciation_residual_non_negative"),
    )


def downgrade() -> None:
    op.drop_table("asset_depreciation_config")

"""add retirement fields to assets

Revision ID: 20260430_0029
Revises: 20260430_0028
Create Date: 2026-04-30
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PGUUID

revision = "20260430_0029"
down_revision = "20260430_0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("assets", sa.Column("retired_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("assets", sa.Column("retirement_reason", sa.Text(), nullable=True))
    op.add_column("assets", sa.Column("salvage_value", sa.Numeric(14, 4), nullable=True))
    op.add_column(
        "assets",
        sa.Column(
            "retired_by",
            PGUUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("assets", "retired_by")
    op.drop_column("assets", "salvage_value")
    op.drop_column("assets", "retirement_reason")
    op.drop_column("assets", "retired_at")

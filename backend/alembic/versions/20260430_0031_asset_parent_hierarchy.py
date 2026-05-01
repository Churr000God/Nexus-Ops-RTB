"""add parent_asset_id hierarchy to assets

Revision ID: 20260430_0031
Revises: 20260430_0030
Create Date: 2026-04-30
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PGUUID

revision = "20260430_0031"
down_revision = "20260430_0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "assets",
        sa.Column(
            "parent_asset_id",
            PGUUID(as_uuid=True),
            sa.ForeignKey("assets.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_assets_parent_asset_id", "assets", ["parent_asset_id"])


def downgrade() -> None:
    op.drop_index("ix_assets_parent_asset_id", table_name="assets")
    op.drop_column("assets", "parent_asset_id")

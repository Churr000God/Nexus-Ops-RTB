"""physical_counts and physical_count_lines

Revision ID: 20260430_0030
Revises: 20260430_0029
Create Date: 2026-04-30
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PGUUID

revision = "20260430_0030"
down_revision = "20260430_0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "physical_counts",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("count_date", sa.Date(), nullable=False),
        sa.Column("location_filter", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", PGUUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_by", PGUUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.CheckConstraint("status IN ('DRAFT','CONFIRMED','CANCELLED')", name="ck_physical_counts_status"),
    )
    op.create_index("ix_physical_counts_count_date", "physical_counts", ["count_date"])
    op.create_index("ix_physical_counts_status", "physical_counts", ["status"])

    op.create_table(
        "physical_count_lines",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("count_id", PGUUID(as_uuid=True), sa.ForeignKey("physical_counts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("asset_id", PGUUID(as_uuid=True), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("asset_code", sa.String(80), nullable=False),
        sa.Column("asset_name", sa.Text(), nullable=False),
        sa.Column("expected_location", sa.Text(), nullable=True),
        sa.Column("scanned_location", sa.Text(), nullable=True),
        sa.Column("found", sa.Boolean(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_physical_count_lines_count_id", "physical_count_lines", ["count_id"])
    op.create_index("ix_physical_count_lines_asset_id", "physical_count_lines", ["asset_id"])


def downgrade() -> None:
    op.drop_table("physical_count_lines")
    op.drop_table("physical_counts")

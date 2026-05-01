"""asset_work_orders — órdenes de mantenimiento por activo

Revision ID: 20260430_0032
Revises: 20260430_0031
Create Date: 2026-04-30
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PGUUID

revision = "20260430_0032"
down_revision = "20260430_0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "asset_work_orders",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("asset_id", PGUUID(as_uuid=True), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("work_type", sa.String(20), nullable=False, server_default="CORRECTIVE"),
        sa.Column("priority", sa.String(10), nullable=False, server_default="MEDIUM"),
        sa.Column("status", sa.String(20), nullable=False, server_default="OPEN"),
        sa.Column("assigned_to", PGUUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("scheduled_date", sa.Date(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cost", sa.Numeric(14, 4), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", PGUUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "work_type IN ('PREVENTIVE','CORRECTIVE','INSPECTION','UPGRADE')",
            name="ck_work_orders_work_type",
        ),
        sa.CheckConstraint(
            "priority IN ('LOW','MEDIUM','HIGH','URGENT')",
            name="ck_work_orders_priority",
        ),
        sa.CheckConstraint(
            "status IN ('OPEN','IN_PROGRESS','DONE','CANCELLED')",
            name="ck_work_orders_status",
        ),
    )
    op.create_index("ix_asset_work_orders_asset_id", "asset_work_orders", ["asset_id"])
    op.create_index("ix_asset_work_orders_status", "asset_work_orders", ["status"])


def downgrade() -> None:
    op.drop_table("asset_work_orders")

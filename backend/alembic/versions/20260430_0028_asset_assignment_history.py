"""asset_assignment_history: serie de tiempo de asignaciones de activos

Cambios:
  1. Tabla asset_assignment_history — log inmutable de asignaciones/desasignaciones
  2. Índices: asset_id, assigned_at

Revision ID: 20260430_0028
Revises: 20260428_0021
Create Date: 2026-04-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260430_0028"
down_revision: str = "20260428_0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "asset_assignment_history",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "asset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("location", sa.Text(), nullable=True),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "assigned_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_asset_assignment_history_asset_id",
        "asset_assignment_history",
        ["asset_id"],
    )
    op.create_index(
        "ix_asset_assignment_history_assigned_at",
        "asset_assignment_history",
        ["assigned_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_asset_assignment_history_assigned_at", "asset_assignment_history")
    op.drop_index("ix_asset_assignment_history_asset_id", "asset_assignment_history")
    op.drop_table("asset_assignment_history")

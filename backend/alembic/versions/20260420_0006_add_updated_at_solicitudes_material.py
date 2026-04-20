"""add updated_at to solicitudes_material

Revision ID: 20260420_0006
Revises: 20260420_0005
Create Date: 2026-04-20 00:00:03
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op


revision: str = "20260420_0006"
down_revision: str | None = "20260420_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE solicitudes_material ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE solicitudes_material DROP COLUMN IF EXISTS updated_at;")

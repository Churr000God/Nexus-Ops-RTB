"""add observations column to no_conformes

Revision ID: 20260420_0007
Revises: 20260420_0006
Create Date: 2026-04-20 00:00:04
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op


revision: str = "20260420_0007"
down_revision: str | None = "20260420_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE no_conformes ADD COLUMN IF NOT EXISTS observations text;")
    op.execute(
        """
        UPDATE no_conformes
        SET observations = notes
        WHERE observations IS NULL AND notes IS NOT NULL;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE no_conformes DROP COLUMN IF EXISTS observations;")

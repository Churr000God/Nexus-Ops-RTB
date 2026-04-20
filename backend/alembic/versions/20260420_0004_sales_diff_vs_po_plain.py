"""make ventas.diff_vs_po a regular column (importable)

Revision ID: 20260420_0004
Revises: 20260420_0003
Create Date: 2026-04-20 00:00:01
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op


revision: str = "20260420_0004"
down_revision: str | None = "20260420_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE ventas DROP COLUMN IF EXISTS diff_vs_po;")
    op.execute("ALTER TABLE ventas ADD COLUMN diff_vs_po numeric(14,4);")


def downgrade() -> None:
    op.execute("ALTER TABLE ventas DROP COLUMN IF EXISTS diff_vs_po;")
    op.execute(
        """
        ALTER TABLE ventas
        ADD COLUMN diff_vs_po numeric(14,4)
        GENERATED ALWAYS AS (
            CASE
                WHEN subtotal IS NULL OR subtotal_in_po IS NULL THEN NULL
                ELSE subtotal - subtotal_in_po
            END
        ) STORED;
        """
    )

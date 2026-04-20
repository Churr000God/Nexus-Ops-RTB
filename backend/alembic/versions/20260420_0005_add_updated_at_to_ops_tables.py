"""add updated_at columns required by ORM defaults

Revision ID: 20260420_0005
Revises: 20260420_0004
Create Date: 2026-04-20 00:00:02
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op


revision: str = "20260420_0005"
down_revision: str | None = "20260420_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE facturas_compras ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();"
    )
    op.execute(
        "ALTER TABLE gastos_operativos ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();"
    )
    op.execute(
        "ALTER TABLE pedidos_clientes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();"
    )
    op.execute(
        "ALTER TABLE entradas_mercancia ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE entradas_mercancia DROP COLUMN IF EXISTS updated_at;")
    op.execute("ALTER TABLE pedidos_clientes DROP COLUMN IF EXISTS updated_at;")
    op.execute("ALTER TABLE gastos_operativos DROP COLUMN IF EXISTS updated_at;")
    op.execute("ALTER TABLE facturas_compras DROP COLUMN IF EXISTS updated_at;")

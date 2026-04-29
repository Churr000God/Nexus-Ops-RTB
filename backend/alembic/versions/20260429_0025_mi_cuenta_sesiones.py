"""mi cuenta: sesiones multi-dispositivo en refresh_tokens

Cambios:
  1. DROP CONSTRAINT uq_refresh_tokens_user_id — permite múltiples sesiones activas por usuario
  2. ADD COLUMN user_agent  TEXT NULL           — navegador / app del cliente
  3. ADD COLUMN ip_address  TEXT NULL           — IP de origen del login
  4. ADD COLUMN last_used_at TIMESTAMPTZ NULL   — última rotación del token

Revision ID: 20260429_0025
Revises: 20260429_0023
Create Date: 2026-04-29
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260429_0025"
down_revision: str = "20260429_0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE refresh_tokens
            DROP CONSTRAINT IF EXISTS uq_refresh_tokens_user_id
    """)

    op.execute("""
        ALTER TABLE refresh_tokens
            ADD COLUMN IF NOT EXISTS user_agent   TEXT,
            ADD COLUMN IF NOT EXISTS ip_address   TEXT,
            ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ
    """)


def downgrade() -> None:
    # Antes de restaurar la unicidad, eliminar duplicados (mantener el más reciente)
    op.execute("""
        DELETE FROM refresh_tokens rt
        WHERE rt.id NOT IN (
            SELECT DISTINCT ON (user_id) id
            FROM refresh_tokens
            ORDER BY user_id, created_at DESC
        )
    """)

    op.execute("""
        ALTER TABLE refresh_tokens
            DROP COLUMN IF EXISTS user_agent,
            DROP COLUMN IF EXISTS ip_address,
            DROP COLUMN IF EXISTS last_used_at
    """)

    op.execute("""
        ALTER TABLE refresh_tokens
            ADD CONSTRAINT uq_refresh_tokens_user_id UNIQUE (user_id)
    """)

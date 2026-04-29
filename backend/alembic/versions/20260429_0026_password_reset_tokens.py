"""auth: tabla password_reset_tokens para flujo forgot-password

Cambios:
  1. CREATE TABLE password_reset_tokens
       id UUID PK, user_id FK, token_hash VARCHAR, expires_at TIMESTAMPTZ,
       created_at TIMESTAMPTZ — tokens de un solo uso, expiran en 1 hora

Revision ID: 20260429_0026
Revises: 20260429_0025
Create Date: 2026-04-29
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260429_0026"
down_revision: str = "20260429_0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE password_reset_tokens (
            id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash   VARCHAR(255) NOT NULL,
            expires_at   TIMESTAMPTZ  NOT NULL,
            created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_prt_user_id ON password_reset_tokens (user_id)")
    op.execute("CREATE INDEX ix_prt_token_hash ON password_reset_tokens (token_hash)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS password_reset_tokens")

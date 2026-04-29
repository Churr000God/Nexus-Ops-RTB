"""auth: columnas TOTP en users y tabla totp_backup_codes para 2FA

Cambios:
  1. ALTER TABLE users ADD COLUMN totp_secret TEXT NULL
  2. ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE
  3. ALTER TABLE users ADD COLUMN totp_setup_at TIMESTAMPTZ NULL
  4. CREATE TABLE totp_backup_codes
       id UUID PK, user_id FK→users CASCADE, code_hash VARCHAR(255),
       used_at TIMESTAMPTZ NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  5. INDEX ix_tbc_user_id ON totp_backup_codes(user_id)

Revision ID: 20260429_0027
Revises: 20260429_0026
Create Date: 2026-04-29
"""

from alembic import op

revision = "20260429_0027"
down_revision = "20260429_0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS totp_secret    TEXT NULL,
            ADD COLUMN IF NOT EXISTS totp_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS totp_setup_at  TIMESTAMPTZ NULL;
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS totp_backup_codes (
            id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID         NOT NULL
                            REFERENCES users(id) ON DELETE CASCADE,
            code_hash   VARCHAR(255) NOT NULL,
            used_at     TIMESTAMPTZ  NULL,
            created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
        );
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_tbc_user_id
            ON totp_backup_codes (user_id);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_tbc_user_id;")
    op.execute("DROP TABLE IF EXISTS totp_backup_codes;")
    op.execute("""
        ALTER TABLE users
            DROP COLUMN IF EXISTS totp_setup_at,
            DROP COLUMN IF EXISTS totp_enabled,
            DROP COLUMN IF EXISTS totp_secret;
    """)

"""delivery_notes 3-state machine: EDICION / APROBADA / CANCELADA

Revision ID: 20260508_0037
Revises: 20260507_0036
Create Date: 2026-05-08
"""
from alembic import op

revision = "20260508_0037"
down_revision = "20260507_0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Drop the old inline check constraint
    op.execute("ALTER TABLE delivery_notes DROP CONSTRAINT IF EXISTS delivery_notes_status_check")

    # 2. Migrate existing rows to the new state vocabulary
    op.execute("""
        UPDATE delivery_notes SET status = 'EDICION'
        WHERE status IN ('DRAFT')
    """)
    op.execute("""
        UPDATE delivery_notes SET status = 'APROBADA'
        WHERE status IN ('ISSUED', 'DELIVERED', 'TRANSFORMED',
                         'PARTIALLY_INVOICED', 'INVOICED')
    """)
    op.execute("""
        UPDATE delivery_notes SET status = 'CANCELADA'
        WHERE status = 'CANCELLED'
    """)

    # 3. Change column default
    op.execute("ALTER TABLE delivery_notes ALTER COLUMN status SET DEFAULT 'EDICION'")

    # 4. Add new constraint
    op.execute("""
        ALTER TABLE delivery_notes
        ADD CONSTRAINT delivery_notes_status_check
        CHECK (status IN ('EDICION', 'APROBADA', 'CANCELADA'))
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE delivery_notes DROP CONSTRAINT IF EXISTS delivery_notes_status_check")

    op.execute("""
        UPDATE delivery_notes SET status = 'DRAFT'
        WHERE status = 'EDICION'
    """)
    op.execute("""
        UPDATE delivery_notes SET status = 'ISSUED'
        WHERE status = 'APROBADA'
    """)
    op.execute("""
        UPDATE delivery_notes SET status = 'CANCELLED'
        WHERE status = 'CANCELADA'
    """)

    op.execute("ALTER TABLE delivery_notes ALTER COLUMN status SET DEFAULT 'DRAFT'")

    op.execute("""
        ALTER TABLE delivery_notes
        ADD CONSTRAINT delivery_notes_status_check
        CHECK (status IN ('DRAFT','ISSUED','DELIVERED','TRANSFORMED',
                          'PARTIALLY_INVOICED','INVOICED','CANCELLED'))
    """)

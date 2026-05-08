"""cost_list_permissions

Revision ID: 20260507_0036
Revises: 20260507_0035
Create Date: 2026-05-07
"""

from alembic import op

revision = "20260507_0036"
down_revision = "20260507_0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO permissions (code, description) VALUES
        ('cost_list.manage', 'Administrar listas de costo Ariba y Refacciones')
        ON CONFLICT (code) DO NOTHING;
    """)
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM roles r, permissions p
        WHERE r.code IN ('ADMIN', 'ACCOUNTING')
          AND p.code = 'cost_list.manage'
        ON CONFLICT DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM role_permissions rp
        USING permissions p
        WHERE rp.permission_id = p.permission_id
          AND p.code = 'cost_list.manage';
    """)
    op.execute("DELETE FROM permissions WHERE code = 'cost_list.manage';")

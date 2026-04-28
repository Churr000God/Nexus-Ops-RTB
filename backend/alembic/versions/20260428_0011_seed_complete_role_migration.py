"""seed: rol READ_ONLY y migración completa de usuarios legacy

Cambios:
  1. Agrega rol READ_ONLY con permisos de solo lectura (13 permisos)
  2. Migra users.role='operativo' → user_roles SALES + WAREHOUSE
  3. Migra users.role='lectura'   → user_roles READ_ONLY

Revision ID: 20260428_0011
Revises: 20260428_0010
Create Date: 2026-04-28 00:00:00
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260428_0011"
down_revision: str = "20260428_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1. Rol READ_ONLY ────────────────────────────────────────────────────
    op.execute("""
        INSERT INTO roles (code, name, description) VALUES
        ('READ_ONLY', 'Solo lectura', 'Acceso de consulta a módulos principales sin poder crear ni modificar');
    """)

    # 13 permisos de solo lectura para READ_ONLY
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM roles r, permissions p
        WHERE r.code = 'READ_ONLY'
          AND p.code IN (
            'customer.view',
            'supplier.view',
            'product.view',
            'quote.view',
            'order.view',
            'purchase_request.create',
            'goods_receipt.create',
            'non_conformity.create',
            'inventory.view',
            'report.sales',
            'report.inventory'
          );
    """)

    # ── 2. Migración de datos: 'operativo' → SALES + WAREHOUSE ─────────────
    op.execute("""
        INSERT INTO user_roles (user_id, role_id)
        SELECT u.id, r.role_id
        FROM users u
        CROSS JOIN roles r
        WHERE u.role = 'operativo'
          AND r.code IN ('SALES', 'WAREHOUSE')
        ON CONFLICT DO NOTHING;
    """)

    # ── 3. Migración de datos: 'lectura' → READ_ONLY ────────────────────────
    op.execute("""
        INSERT INTO user_roles (user_id, role_id)
        SELECT u.id, r.role_id
        FROM users u
        JOIN roles r ON r.code = 'READ_ONLY'
        WHERE u.role = 'lectura'
        ON CONFLICT DO NOTHING;
    """)


def downgrade() -> None:
    # Revertir asignaciones de roles de usuarios legacy
    op.execute("""
        DELETE FROM user_roles ur
        USING roles r, users u
        WHERE ur.role_id = r.role_id
          AND ur.user_id = u.id
          AND r.code IN ('SALES', 'WAREHOUSE')
          AND u.role = 'operativo';
    """)
    op.execute("""
        DELETE FROM user_roles ur
        USING roles r, users u
        WHERE ur.role_id = r.role_id
          AND ur.user_id = u.id
          AND r.code = 'READ_ONLY'
          AND u.role = 'lectura';
    """)

    # Eliminar rol READ_ONLY (cascade borra role_permissions)
    op.execute("DELETE FROM roles WHERE code = 'READ_ONLY';")

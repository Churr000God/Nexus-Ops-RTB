"""security: RBAC (roles/permissions) y audit_log

Cambios:
  1. users: agrega full_name y last_login_at
  2. Crea tablas: roles, permissions, role_permissions, user_roles, audit_log
  3. Seed inicial: 5 roles, 42 permisos, matriz role_permissions
  4. Migra usuarios existentes con role='admin' al rol ADMIN
  5. Trigger fn_audit_changes + triggers en users, user_roles, role_permissions

Revision ID: 20260428_0010
Revises: 20260427_0009
Create Date: 2026-04-28 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260428_0010"
down_revision: str = "20260427_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1. users: nuevas columnas ──────────────────────────────────────────
    op.add_column(
        "users",
        sa.Column("full_name", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "users",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── 2. roles ───────────────────────────────────────────────────────────
    op.create_table(
        "roles",
        sa.Column(
            "role_id",
            sa.SmallInteger(),
            sa.Identity(always=True),
            nullable=False,
        ),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("role_id"),
        sa.UniqueConstraint("code", name="uq_roles_code"),
    )

    # ── 3. permissions ─────────────────────────────────────────────────────
    op.create_table(
        "permissions",
        sa.Column(
            "permission_id",
            sa.SmallInteger(),
            sa.Identity(always=True),
            nullable=False,
        ),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("permission_id"),
        sa.UniqueConstraint("code", name="uq_permissions_code"),
    )

    # ── 4. role_permissions (puente N:N) ───────────────────────────────────
    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.SmallInteger(), nullable=False),
        sa.Column("permission_id", sa.SmallInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["role_id"], ["roles.role_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["permission_id"],
            ["permissions.permission_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("role_id", "permission_id"),
    )

    # ── 5. user_roles (puente N:N) ─────────────────────────────────────────
    op.create_table(
        "user_roles",
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("role_id", sa.SmallInteger(), nullable=False),
        sa.Column(
            "granted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["role_id"], ["roles.role_id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", "role_id"),
    )

    # ── 6. audit_log ───────────────────────────────────────────────────────
    op.create_table(
        "audit_log",
        sa.Column(
            "audit_id",
            sa.BigInteger(),
            sa.Identity(always=True),
            nullable=False,
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), nullable=True
        ),
        sa.Column("entity_type", sa.Text(), nullable=False),
        # TEXT para soportar tanto UUID como BIGINT como PK de las tablas auditadas
        sa.Column("entity_id", sa.Text(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("before_data", postgresql.JSONB(), nullable=True),
        sa.Column("after_data", postgresql.JSONB(), nullable=True),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "action IN ('INSERT', 'UPDATE', 'DELETE')",
            name="chk_audit_action",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("audit_id"),
    )
    op.create_index("idx_audit_entity", "audit_log", ["entity_type", "entity_id"])
    op.execute(
        "CREATE INDEX idx_audit_changed_at ON audit_log (changed_at DESC);"
    )

    # ── 7. Seed: roles ─────────────────────────────────────────────────────
    op.execute("""
        INSERT INTO roles (code, name, description) VALUES
        ('ADMIN',      'Administrador', 'Acceso total al sistema'),
        ('SALES',      'Ventas',        'Cotizaciones, clientes, seguimiento de pedidos'),
        ('PURCHASING', 'Compras',       'Solicitudes, OCs, facturas de proveedor'),
        ('WAREHOUSE',  'Almacén',       'Recepciones, ajustes, no conformes, empacado'),
        ('ACCOUNTING', 'Contabilidad',  'CFDI, pagos, gastos operativos');
    """)

    # ── 8. Seed: permissions ───────────────────────────────────────────────
    op.execute("""
        INSERT INTO permissions (code, description) VALUES
        ('user.view',                'Ver lista de usuarios'),
        ('user.manage',              'Crear, editar, desactivar usuarios'),
        ('role.manage',              'Crear roles y asignar permisos'),
        ('customer.view',            'Ver clientes y sus datos'),
        ('customer.manage',          'Crear, editar, desactivar clientes'),
        ('supplier.view',            'Ver proveedores'),
        ('supplier.manage',          'Crear, editar, desactivar proveedores'),
        ('product.view',             'Ver catálogo de productos'),
        ('product.manage',           'Crear, editar productos y configuraciones'),
        ('product.price.manage',     'Cambiar precios de venta'),
        ('quote.view',               'Ver cotizaciones'),
        ('quote.create',             'Crear cotizaciones nuevas'),
        ('quote.edit',               'Editar cotización en estado DRAFT'),
        ('quote.send',               'Enviar cotización al cliente'),
        ('quote.approve',            'Aprobar cotización'),
        ('quote.cancel',             'Cancelar cotización'),
        ('order.view',               'Ver pedidos'),
        ('order.pack',               'Empacar pedido'),
        ('order.ship',               'Marcar pedido como enviado'),
        ('order.deliver',            'Confirmar entrega'),
        ('order.cancel',             'Cancelar pedido'),
        ('purchase_request.create',  'Crear solicitud de material'),
        ('purchase_request.approve', 'Aprobar solicitud de material'),
        ('purchase_order.create',    'Crear OC al proveedor'),
        ('purchase_order.send',      'Enviar OC'),
        ('purchase_order.cancel',    'Cancelar OC'),
        ('goods_receipt.create',     'Registrar entrada de mercancía'),
        ('goods_receipt.validate',   'Validar físicamente la mercancía recibida'),
        ('supplier_invoice.capture', 'Capturar factura de proveedor'),
        ('supplier_invoice.pay',     'Marcar factura de proveedor como pagada'),
        ('non_conformity.create',    'Levantar no conforme'),
        ('non_conformity.resolve',   'Resolver no conforme'),
        ('inventory.view',           'Consultar stock'),
        ('inventory.adjust',         'Ajuste manual de inventario'),
        ('cfdi.issue',               'Emitir CFDI tipo I al cliente'),
        ('cfdi.cancel',              'Cancelar CFDI ante el SAT'),
        ('cfdi.credit_note',         'Emitir nota de crédito (CFDI tipo E)'),
        ('payment.register',         'Registrar pago recibido del cliente'),
        ('expense.create',           'Capturar gasto operativo'),
        ('report.sales',             'Ver reporte de ventas'),
        ('report.inventory',         'Ver reporte de inventario y KPIs'),
        ('report.financial',         'Ver reportes financieros'),
        ('audit.view',               'Ver bitácora de auditoría');
    """)

    # ── 9. Seed: role_permissions ──────────────────────────────────────────
    # ADMIN: todos los permisos
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM roles r CROSS JOIN permissions p
        WHERE r.code = 'ADMIN';
    """)

    # SALES
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM roles r, permissions p
        WHERE r.code = 'SALES'
          AND p.code IN (
            'customer.view', 'customer.manage',
            'product.view', 'product.price.manage',
            'quote.view', 'quote.create', 'quote.edit',
            'quote.send', 'quote.approve', 'quote.cancel',
            'order.view', 'order.cancel',
            'purchase_request.create',
            'inventory.view',
            'report.sales', 'report.inventory'
          );
    """)

    # PURCHASING
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM roles r, permissions p
        WHERE r.code = 'PURCHASING'
          AND p.code IN (
            'supplier.view', 'supplier.manage',
            'product.view',
            'purchase_request.create', 'purchase_request.approve',
            'purchase_order.create', 'purchase_order.send', 'purchase_order.cancel',
            'goods_receipt.create', 'goods_receipt.validate',
            'supplier_invoice.capture', 'supplier_invoice.pay',
            'order.view',
            'inventory.view',
            'report.inventory'
          );
    """)

    # WAREHOUSE
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM roles r, permissions p
        WHERE r.code = 'WAREHOUSE'
          AND p.code IN (
            'product.view',
            'goods_receipt.create', 'goods_receipt.validate',
            'non_conformity.create', 'non_conformity.resolve',
            'inventory.view', 'inventory.adjust',
            'order.view', 'order.pack', 'order.ship', 'order.deliver',
            'report.inventory'
          );
    """)

    # ACCOUNTING
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM roles r, permissions p
        WHERE r.code = 'ACCOUNTING'
          AND p.code IN (
            'customer.view',
            'supplier.view',
            'product.view',
            'quote.view',
            'order.view',
            'supplier_invoice.capture', 'supplier_invoice.pay',
            'cfdi.issue', 'cfdi.cancel', 'cfdi.credit_note',
            'payment.register',
            'expense.create',
            'inventory.view',
            'report.sales', 'report.inventory', 'report.financial'
          );
    """)

    # ── 10. Data migration: users existentes → user_roles ──────────────────
    # Solo admin → ADMIN; el resto lo reasigna el admin desde la UI
    op.execute("""
        INSERT INTO user_roles (user_id, role_id)
        SELECT u.id, r.role_id
        FROM users u
        JOIN roles r ON r.code = 'ADMIN'
        WHERE u.role = 'admin'
        ON CONFLICT DO NOTHING;
    """)

    # ── 11. Trigger fn_audit_changes ───────────────────────────────────────
    # Se crea DESPUÉS del seed para no contaminar audit_log con datos iniciales
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_audit_changes()
        RETURNS TRIGGER AS $$
        DECLARE
            v_user_id UUID;
            v_entity_id TEXT;
            v_before JSONB;
            v_after JSONB;
        BEGIN
            BEGIN
                v_user_id := current_setting('rtb.current_user_id', true)::UUID;
            EXCEPTION WHEN OTHERS THEN
                v_user_id := NULL;
            END;

            IF TG_OP = 'DELETE' THEN
                v_before     := to_jsonb(OLD);
                v_after      := NULL;
                v_entity_id  := COALESCE(to_jsonb(OLD)->>'id', '');
            ELSIF TG_OP = 'INSERT' THEN
                v_before     := NULL;
                v_after      := to_jsonb(NEW);
                v_entity_id  := COALESCE(to_jsonb(NEW)->>'id', '');
            ELSE
                v_before     := to_jsonb(OLD);
                v_after      := to_jsonb(NEW);
                v_entity_id  := COALESCE(to_jsonb(NEW)->>'id', '');
            END IF;

            INSERT INTO audit_log
                (user_id, entity_type, entity_id, action, before_data, after_data)
            VALUES
                (v_user_id, TG_TABLE_NAME, v_entity_id, TG_OP, v_before, v_after);

            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Triggers en tablas de seguridad
    op.execute("""
        CREATE TRIGGER trg_audit_users
        AFTER INSERT OR UPDATE OR DELETE ON users
        FOR EACH ROW EXECUTE FUNCTION fn_audit_changes();
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_user_roles
        AFTER INSERT OR UPDATE OR DELETE ON user_roles
        FOR EACH ROW EXECUTE FUNCTION fn_audit_changes();
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_role_permissions
        AFTER INSERT OR UPDATE OR DELETE ON role_permissions
        FOR EACH ROW EXECUTE FUNCTION fn_audit_changes();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_audit_role_permissions ON role_permissions;")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_user_roles ON user_roles;")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_users ON users;")
    op.execute("DROP FUNCTION IF EXISTS fn_audit_changes();")

    op.execute("DROP INDEX IF EXISTS idx_audit_changed_at;")
    op.drop_index("idx_audit_entity", table_name="audit_log")
    op.drop_table("audit_log")
    op.drop_table("user_roles")
    op.drop_table("role_permissions")
    op.drop_table("permissions")
    op.drop_table("roles")

    op.drop_column("users", "last_login_at")
    op.drop_column("users", "full_name")

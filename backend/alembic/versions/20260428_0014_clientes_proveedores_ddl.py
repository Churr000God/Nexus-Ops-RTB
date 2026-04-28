"""clientes_proveedores: DDL completo del módulo Clientes y Proveedores

Cambios DDL (todas antes de los datos, per regla del proyecto):
  1.  CREATE EXTENSION citext              — comparación RFC case-insensitive
  2.  CREATE TABLE sat_tax_regimes         — catálogo regímenes fiscales SAT
  3.  CREATE TABLE sat_cfdi_uses           — catálogo usos CFDI SAT
  4.  CREATE TABLE customers               — cabecera comercial del cliente
  5.  CREATE TABLE customer_tax_data       — RFC/razón social (multi-RFC)
  6.  CREATE TABLE customer_addresses      — FISCAL / DELIVERY / OTHER
  7.  CREATE TABLE customer_contacts       — personas de contacto del cliente
  8.  CREATE TABLE suppliers               — cabecera comercial del proveedor
  9.  CREATE TABLE supplier_tax_data       — RFC/razón social del proveedor
  10. CREATE TABLE supplier_addresses      — FISCAL / PICKUP / OTHER
  11. CREATE TABLE supplier_contacts       — personas de contacto del proveedor
  12. CREATE TABLE supplier_products       — catálogo con histórico de precios

Cambios de datos (DESPUÉS de todo el DDL):
  13. Seed sat_tax_regimes  (19 regímenes SAT 2024)
  14. Seed sat_cfdi_uses    (24 usos CFDI 4.0 vigentes)
  15. Permisos RBAC: customer.view/manage, supplier.view/manage
  16. Asignación de permisos a roles existentes

Revision ID: 20260428_0014
Revises: 20260428_0013
Create Date: 2026-04-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260428_0014"
down_revision: str = "20260428_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1. Extensión citext ────────────────────────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")

    # ── 2. sat_tax_regimes ────────────────────────────────────────────────────
    op.create_table(
        "sat_tax_regimes",
        sa.Column(
            "regime_id",
            sa.SmallInteger(),
            sa.Identity(always=True),
            primary_key=True,
        ),
        sa.Column("code", sa.String(10), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "applies_to",
            sa.String(10),
            nullable=False,
            server_default="BOTH",
        ),
        sa.UniqueConstraint("code", name="uq_sat_tax_regimes_code"),
    )
    op.create_index("ix_sat_tax_regimes_code", "sat_tax_regimes", ["code"])

    # ── 3. sat_cfdi_uses ──────────────────────────────────────────────────────
    op.create_table(
        "sat_cfdi_uses",
        sa.Column("use_id", sa.String(10), primary_key=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "applies_to",
            sa.String(10),
            nullable=False,
            server_default="BOTH",
        ),
    )

    # ── 4. customers ──────────────────────────────────────────────────────────
    op.create_table(
        "customers",
        sa.Column(
            "customer_id",
            sa.BigInteger(),
            sa.Identity(always=True),
            primary_key=True,
        ),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("business_name", sa.Text(), nullable=False),
        sa.Column(
            "customer_type",
            sa.String(10),
            nullable=False,
            server_default="COMPANY",
        ),
        sa.Column(
            "locality",
            sa.String(10),
            nullable=False,
            server_default="LOCAL",
        ),
        sa.Column(
            "payment_terms_days",
            sa.SmallInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("credit_limit", sa.Numeric(14, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="MXN"),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("code", name="uq_customers_code"),
        sa.CheckConstraint(
            "customer_type IN ('COMPANY','PERSON')",
            name="ck_customers_customer_type",
        ),
        sa.CheckConstraint(
            "locality IN ('LOCAL','FOREIGN')",
            name="ck_customers_locality",
        ),
    )
    op.create_index("ix_customers_code", "customers", ["code"])
    op.create_index("ix_customers_is_active", "customers", ["is_active"])

    # ── 5. customer_tax_data ──────────────────────────────────────────────────
    # La columna rfc usa CITEXT (case-insensitive); se crea via DDL raw
    # para que SQLAlchemy no sobrescriba el tipo en futuros autogenerate.
    op.execute("""
        CREATE TABLE customer_tax_data (
            tax_data_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            customer_id     BIGINT NOT NULL
                            REFERENCES customers(customer_id) ON DELETE CASCADE,
            rfc             CITEXT NOT NULL,
            legal_name      TEXT   NOT NULL,
            tax_regime_id   SMALLINT
                            REFERENCES sat_tax_regimes(regime_id) ON DELETE SET NULL,
            cfdi_use_id     TEXT
                            REFERENCES sat_cfdi_uses(use_id) ON DELETE SET NULL,
            zip_code        TEXT   NOT NULL,
            is_default      BOOLEAN NOT NULL DEFAULT TRUE,
            CONSTRAINT uq_customer_tax_data_customer_rfc UNIQUE (customer_id, rfc)
        )
    """)
    op.execute(
        "CREATE INDEX ix_customer_tax_data_customer_id"
        " ON customer_tax_data (customer_id)"
    )

    # ── 6. customer_addresses ─────────────────────────────────────────────────
    op.create_table(
        "customer_addresses",
        sa.Column(
            "address_id",
            sa.BigInteger(),
            sa.Identity(always=True),
            primary_key=True,
        ),
        sa.Column(
            "customer_id",
            sa.BigInteger(),
            sa.ForeignKey("customers.customer_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("address_type", sa.String(10), nullable=False),
        sa.Column(
            "tax_data_id",
            sa.BigInteger(),
            sa.ForeignKey("customer_tax_data.tax_data_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("street", sa.Text(), nullable=False),
        sa.Column("exterior_number", sa.Text(), nullable=True),
        sa.Column("interior_number", sa.Text(), nullable=True),
        sa.Column("neighborhood", sa.Text(), nullable=True),
        sa.Column("city", sa.Text(), nullable=True),
        sa.Column("state", sa.Text(), nullable=True),
        sa.Column("country", sa.Text(), nullable=False, server_default="México"),
        sa.Column("zip_code", sa.String(10), nullable=True),
        sa.Column(
            "is_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.CheckConstraint(
            "address_type IN ('FISCAL','DELIVERY','OTHER')",
            name="ck_customer_addresses_address_type",
        ),
        sa.CheckConstraint(
            "(address_type = 'FISCAL' AND tax_data_id IS NOT NULL)"
            " OR (address_type <> 'FISCAL' AND tax_data_id IS NULL)",
            name="ck_customer_addresses_fiscal_tax_data",
        ),
    )
    op.create_index(
        "ix_customer_addresses_customer_id", "customer_addresses", ["customer_id"]
    )

    # ── 7. customer_contacts ──────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE customer_contacts (
            contact_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            customer_id BIGINT NOT NULL
                        REFERENCES customers(customer_id) ON DELETE CASCADE,
            full_name   TEXT NOT NULL,
            role_title  TEXT,
            email       CITEXT,
            phone       TEXT,
            is_primary  BOOLEAN NOT NULL DEFAULT FALSE
        )
    """)
    op.execute(
        "CREATE INDEX ix_customer_contacts_customer_id"
        " ON customer_contacts (customer_id)"
    )

    # ── 8. suppliers ──────────────────────────────────────────────────────────
    op.create_table(
        "suppliers",
        sa.Column(
            "supplier_id",
            sa.BigInteger(),
            sa.Identity(always=True),
            primary_key=True,
        ),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("business_name", sa.Text(), nullable=False),
        sa.Column(
            "supplier_type",
            sa.String(10),
            nullable=False,
            server_default="GOODS",
        ),
        sa.Column(
            "locality",
            sa.String(10),
            nullable=False,
            server_default="LOCAL",
        ),
        sa.Column(
            "is_occasional",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "payment_terms_days",
            sa.SmallInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("avg_payment_time_days", sa.SmallInteger(), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="MXN"),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("code", name="uq_suppliers_code"),
        sa.CheckConstraint(
            "supplier_type IN ('GOODS','SERVICES','BOTH')",
            name="ck_suppliers_supplier_type",
        ),
        sa.CheckConstraint(
            "locality IN ('LOCAL','FOREIGN')",
            name="ck_suppliers_locality",
        ),
    )
    op.create_index("ix_suppliers_code", "suppliers", ["code"])
    op.create_index("ix_suppliers_is_active", "suppliers", ["is_active"])
    op.create_index("ix_suppliers_is_occasional", "suppliers", ["is_occasional"])

    # ── 9. supplier_tax_data ──────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE supplier_tax_data (
            tax_data_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            supplier_id     BIGINT NOT NULL
                            REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
            rfc             CITEXT NOT NULL,
            legal_name      TEXT   NOT NULL,
            tax_regime_id   SMALLINT
                            REFERENCES sat_tax_regimes(regime_id) ON DELETE SET NULL,
            zip_code        TEXT   NOT NULL,
            is_default      BOOLEAN NOT NULL DEFAULT TRUE,
            CONSTRAINT uq_supplier_tax_data_supplier_rfc UNIQUE (supplier_id, rfc)
        )
    """)
    op.execute(
        "CREATE INDEX ix_supplier_tax_data_supplier_id"
        " ON supplier_tax_data (supplier_id)"
    )

    # ── 10. supplier_addresses ────────────────────────────────────────────────
    op.create_table(
        "supplier_addresses",
        sa.Column(
            "address_id",
            sa.BigInteger(),
            sa.Identity(always=True),
            primary_key=True,
        ),
        sa.Column(
            "supplier_id",
            sa.BigInteger(),
            sa.ForeignKey("suppliers.supplier_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("address_type", sa.String(10), nullable=False),
        sa.Column(
            "tax_data_id",
            sa.BigInteger(),
            sa.ForeignKey("supplier_tax_data.tax_data_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("street", sa.Text(), nullable=False),
        sa.Column("exterior_number", sa.Text(), nullable=True),
        sa.Column("interior_number", sa.Text(), nullable=True),
        sa.Column("neighborhood", sa.Text(), nullable=True),
        sa.Column("city", sa.Text(), nullable=True),
        sa.Column("state", sa.Text(), nullable=True),
        sa.Column("country", sa.Text(), nullable=False, server_default="México"),
        sa.Column("zip_code", sa.String(10), nullable=True),
        sa.Column(
            "is_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.CheckConstraint(
            "address_type IN ('FISCAL','PICKUP','OTHER')",
            name="ck_supplier_addresses_address_type",
        ),
        sa.CheckConstraint(
            "(address_type = 'FISCAL' AND tax_data_id IS NOT NULL)"
            " OR (address_type <> 'FISCAL' AND tax_data_id IS NULL)",
            name="ck_supplier_addresses_fiscal_tax_data",
        ),
    )
    op.create_index(
        "ix_supplier_addresses_supplier_id", "supplier_addresses", ["supplier_id"]
    )

    # ── 11. supplier_contacts ─────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE supplier_contacts (
            contact_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            supplier_id BIGINT NOT NULL
                        REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
            full_name   TEXT NOT NULL,
            role_title  TEXT,
            email       CITEXT,
            phone       TEXT,
            is_primary  BOOLEAN NOT NULL DEFAULT FALSE
        )
    """)
    op.execute(
        "CREATE INDEX ix_supplier_contacts_supplier_id"
        " ON supplier_contacts (supplier_id)"
    )

    # ── 12. supplier_products ─────────────────────────────────────────────────
    # product_id referencia productos.id (UUID) del catálogo legacy
    op.create_table(
        "supplier_products",
        sa.Column(
            "supplier_product_id",
            sa.BigInteger(),
            sa.Identity(always=True),
            primary_key=True,
        ),
        sa.Column(
            "supplier_id",
            sa.BigInteger(),
            sa.ForeignKey("suppliers.supplier_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("productos.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("supplier_sku", sa.Text(), nullable=True),
        sa.Column("unit_cost", sa.Numeric(14, 4), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="MXN"),
        sa.Column("lead_time_days", sa.SmallInteger(), nullable=True),
        sa.Column("moq", sa.Numeric(14, 4), nullable=True),
        sa.Column(
            "is_available",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "is_preferred",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "valid_from",
            sa.Date(),
            nullable=False,
            server_default=sa.text("CURRENT_DATE"),
        ),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column(
            "is_current",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "unit_cost >= 0",
            name="ck_supplier_products_unit_cost_nonneg",
        ),
    )
    op.create_index(
        "ix_supplier_products_supplier_id", "supplier_products", ["supplier_id"]
    )
    op.create_index(
        "ix_supplier_products_product_id", "supplier_products", ["product_id"]
    )
    op.create_index(
        "ix_supplier_products_is_current", "supplier_products", ["is_current"]
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # DATA: todo lo de datos va DESPUÉS de todo el DDL
    # ═══════════════════════════════════════════════════════════════════════════

    # ── 13. Seed sat_tax_regimes ───────────────────────────────────────────────
    op.execute("""
        INSERT INTO sat_tax_regimes (code, description, applies_to) VALUES
        ('601', 'General de Ley Personas Morales',                              'MORAL'),
        ('603', 'Personas Morales con Fines no Lucrativos',                     'MORAL'),
        ('605', 'Sueldos y Salarios e Ingresos Asimilados a Salarios',          'FISICA'),
        ('606', 'Arrendamiento',                                                 'FISICA'),
        ('607', 'Régimen de Enajenación o Adquisición de Bienes',               'FISICA'),
        ('608', 'Demás ingresos',                                                'FISICA'),
        ('610', 'Residentes en el Extranjero sin Establecimiento Permanente',   'BOTH'),
        ('611', 'Ingresos por Dividendos (socios y accionistas)',                'FISICA'),
        ('612', 'Personas Físicas con Actividades Empresariales y Profesionales','FISICA'),
        ('614', 'Ingresos por intereses',                                        'FISICA'),
        ('615', 'Régimen de los ingresos por obtención de premios',              'FISICA'),
        ('616', 'Sin obligaciones fiscales',                                     'FISICA'),
        ('620', 'Sociedades Cooperativas de Producción',                         'MORAL'),
        ('621', 'Incorporación Fiscal',                                          'FISICA'),
        ('622', 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',     'BOTH'),
        ('623', 'Opcional para Grupos de Sociedades',                            'MORAL'),
        ('624', 'Coordinados',                                                   'MORAL'),
        ('625', 'Actividades Empresariales con ingresos a través de Plataformas','FISICA'),
        ('626', 'Régimen Simplificado de Confianza (RESICO)',                    'BOTH')
        ON CONFLICT (code) DO NOTHING
    """)

    # ── 14. Seed sat_cfdi_uses ─────────────────────────────────────────────────
    op.execute("""
        INSERT INTO sat_cfdi_uses (use_id, description, applies_to) VALUES
        ('G01', 'Adquisición de mercancias',                                     'BOTH'),
        ('G02', 'Devoluciones, descuentos o bonificaciones',                     'BOTH'),
        ('G03', 'Gastos en general',                                             'BOTH'),
        ('I01', 'Construcciones',                                                'BOTH'),
        ('I02', 'Mobilario y equipo de oficina por inversiones',                 'BOTH'),
        ('I03', 'Equipo de transporte',                                          'BOTH'),
        ('I04', 'Equipo de computo y accesorios',                                'BOTH'),
        ('I05', 'Dados, troqueles, moldes, matrices y herramental',              'BOTH'),
        ('I06', 'Comunicaciones telefónicas',                                    'BOTH'),
        ('I07', 'Comunicaciones satelitales',                                    'BOTH'),
        ('I08', 'Otra maquinaria y equipo',                                      'BOTH'),
        ('D01', 'Honorarios médicos, dentales y gastos hospitalarios',           'FISICA'),
        ('D02', 'Gastos médicos por incapacidad o discapacidad',                 'FISICA'),
        ('D03', 'Gastos funerales',                                              'FISICA'),
        ('D04', 'Donativos',                                                     'FISICA'),
        ('D05', 'Intereses reales por créditos hipotecarios (casa habitación)',  'FISICA'),
        ('D06', 'Aportaciones voluntarias al SAR',                               'FISICA'),
        ('D07', 'Primas por seguros de gastos médicos',                         'FISICA'),
        ('D08', 'Gastos de transportación escolar obligatoria',                  'FISICA'),
        ('D09', 'Depósitos en cuentas para el ahorro / planes de pensiones',    'FISICA'),
        ('D10', 'Pagos por servicios educativos (colegiaturas)',                 'FISICA'),
        ('S01', 'Sin efectos fiscales',                                          'BOTH'),
        ('CP01','Pagos',                                                         'BOTH'),
        ('CN01','Nómina',                                                        'BOTH')
        ON CONFLICT (use_id) DO NOTHING
    """)

    # ── 15. Permisos RBAC ─────────────────────────────────────────────────────
    op.execute("""
        INSERT INTO permissions (code, description) VALUES
        ('customer.view',   'Ver listado y ficha de clientes'),
        ('customer.manage', 'Crear y modificar clientes, datos fiscales, direcciones y contactos'),
        ('supplier.view',   'Ver listado y ficha de proveedores'),
        ('supplier.manage', 'Crear y modificar proveedores, datos fiscales, catálogo de productos')
        ON CONFLICT (code) DO NOTHING
    """)

    # ── 16. Asignación de permisos a roles ────────────────────────────────────
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM roles r
        CROSS JOIN permissions p
        WHERE (r.code = 'ADMIN'      AND p.code IN ('customer.view','customer.manage','supplier.view','supplier.manage'))
           OR (r.code = 'SALES'      AND p.code IN ('customer.view','customer.manage'))
           OR (r.code = 'ACCOUNTING' AND p.code IN ('customer.view','supplier.view'))
           OR (r.code = 'PURCHASING' AND p.code IN ('supplier.view','supplier.manage'))
           OR (r.code = 'WAREHOUSE'  AND p.code IN ('supplier.view'))
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    # Revocar permisos (no estrictamente necesario dado el DROP TABLE cascade)
    op.execute("""
        DELETE FROM role_permissions
        WHERE permission_id IN (
            SELECT permission_id FROM permissions
            WHERE code IN ('customer.view','customer.manage','supplier.view','supplier.manage')
        )
    """)
    op.execute("""
        DELETE FROM permissions
        WHERE code IN ('customer.view','customer.manage','supplier.view','supplier.manage')
    """)

    # Tablas en orden inverso de dependencias
    op.drop_table("supplier_products")
    op.drop_table("supplier_contacts")
    op.drop_table("supplier_addresses")
    op.drop_table("supplier_tax_data")
    op.drop_table("suppliers")
    op.drop_table("customer_contacts")
    op.drop_table("customer_addresses")
    op.drop_table("customer_tax_data")
    op.drop_table("customers")
    op.drop_table("sat_cfdi_uses")
    op.drop_table("sat_tax_regimes")

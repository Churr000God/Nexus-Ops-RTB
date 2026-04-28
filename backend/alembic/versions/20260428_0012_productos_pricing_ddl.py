"""productos_pricing: DDL completo del módulo Productos & Pricing

Cambios DDL (todas antes de los datos, per regla del proyecto):
  1. CREATE TABLE sat_product_keys (catálogo SAT claves de producto)
  2. CREATE TABLE sat_unit_keys    (catálogo SAT claves de unidad)
  3. ALTER TABLE categorias        — parent_id (jerárquica), slug
  4. ALTER TABLE productos         — pricing_strategy, moving_avg_months,
                                     current_avg_cost*, is_configurable,
                                     is_assembled, sat_product_key_id, sat_unit_id
  5. ALTER TABLE movimientos_inventario — unit_cost (necesario para trigger de costo)
  6. CREATE TABLE product_attributes
  7. CREATE TABLE product_attribute_options
  8. CREATE TABLE product_configurations
  9. CREATE TABLE bom
 10. CREATE TABLE bom_items
 11. CREATE TABLE customer_contract_prices
 12. CREATE TABLE product_cost_history

Cambios de datos (DESPUÉS de todo el DDL):
 13. Seed sat_unit_keys  (34 claves estándar)
 14. Seed sat_product_keys (~70 claves industriales relevantes para RTB)
 15. Permiso customer_contract_price.manage → ADMIN + ACCOUNTING
 16. Backfill current_avg_cost = unit_price para productos existentes con precio
 17. Backfill slugs para categorías existentes

Revision ID: 20260428_0012
Revises: 20260428_0011
Create Date: 2026-04-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260428_0012"
down_revision: str = "20260428_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1. sat_product_keys ────────────────────────────────────────────────────
    op.create_table(
        "sat_product_keys",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("code", sa.String(8), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_sat_product_keys_code"),
    )
    op.create_index("ix_sat_product_keys_code", "sat_product_keys", ["code"])

    # ── 2. sat_unit_keys ───────────────────────────────────────────────────────
    op.create_table(
        "sat_unit_keys",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("code", sa.String(6), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_sat_unit_keys_code"),
    )
    op.create_index("ix_sat_unit_keys_code", "sat_unit_keys", ["code"])

    # ── 3. ALTER categorias ────────────────────────────────────────────────────
    op.add_column(
        "categorias",
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_categorias_parent_id",
        "categorias",
        "categorias",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column("categorias", sa.Column("slug", sa.Text(), nullable=True))
    op.create_unique_constraint("uq_categorias_slug", "categorias", ["slug"])

    # ── 4. ALTER productos ─────────────────────────────────────────────────────
    op.add_column(
        "productos",
        sa.Column(
            "pricing_strategy",
            sa.String(20),
            nullable=False,
            server_default="MOVING_AVG",
        ),
    )
    op.create_check_constraint(
        "ck_productos_pricing_strategy",
        "productos",
        "pricing_strategy IN ('MOVING_AVG', 'PASSTHROUGH')",
    )
    op.add_column(
        "productos",
        sa.Column(
            "moving_avg_months",
            sa.SmallInteger(),
            nullable=False,
            server_default="6",
        ),
    )
    op.create_check_constraint(
        "ck_productos_moving_avg_months",
        "productos",
        "moving_avg_months BETWEEN 1 AND 60",
    )
    op.add_column(
        "productos",
        sa.Column("current_avg_cost", sa.Numeric(14, 4), nullable=True),
    )
    op.add_column(
        "productos",
        sa.Column(
            "current_avg_cost_currency",
            sa.String(3),
            nullable=False,
            server_default="MXN",
        ),
    )
    op.add_column(
        "productos",
        sa.Column("current_avg_cost_updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "productos",
        sa.Column(
            "is_configurable",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "productos",
        sa.Column(
            "is_assembled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "productos",
        sa.Column("sat_product_key_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_productos_sat_product_key_id",
        "productos",
        "sat_product_keys",
        ["sat_product_key_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "productos",
        sa.Column("sat_unit_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_productos_sat_unit_id",
        "productos",
        "sat_unit_keys",
        ["sat_unit_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # ── 5. ALTER movimientos_inventario ────────────────────────────────────────
    op.add_column(
        "movimientos_inventario",
        sa.Column("unit_cost", sa.Numeric(14, 4), nullable=True),
    )

    # ── 6. product_attributes ──────────────────────────────────────────────────
    op.create_table(
        "product_attributes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("data_type", sa.String(10), nullable=False),
        sa.Column(
            "is_required",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["productos.id"],
            ondelete="CASCADE",
            name="fk_product_attributes_product_id",
        ),
        sa.UniqueConstraint(
            "product_id", "name", name="uq_product_attributes_product_name"
        ),
        sa.CheckConstraint(
            "data_type IN ('TEXT','NUMBER','BOOLEAN','OPTION')",
            name="ck_product_attributes_data_type",
        ),
    )
    op.create_index("ix_product_attributes_product_id", "product_attributes", ["product_id"])

    # ── 7. product_attribute_options ───────────────────────────────────────────
    op.create_table(
        "product_attribute_options",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("attribute_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column(
            "extra_cost",
            sa.Numeric(14, 4),
            nullable=False,
            server_default="0",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["attribute_id"],
            ["product_attributes.id"],
            ondelete="CASCADE",
            name="fk_product_attribute_options_attribute_id",
        ),
        sa.UniqueConstraint(
            "attribute_id", "value", name="uq_product_attribute_options_attr_value"
        ),
    )

    # ── 8. product_configurations ──────────────────────────────────────────────
    op.create_table(
        "product_configurations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("config_sku", sa.Text(), nullable=True),
        sa.Column("config_hash", sa.Text(), nullable=False),
        sa.Column("attributes", postgresql.JSONB(), nullable=False),
        sa.Column(
            "additional_cost",
            sa.Numeric(14, 4),
            nullable=False,
            server_default="0",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["productos.id"],
            ondelete="CASCADE",
            name="fk_product_configurations_product_id",
        ),
        sa.UniqueConstraint("config_sku", name="uq_product_configurations_config_sku"),
        sa.UniqueConstraint(
            "product_id",
            "config_hash",
            name="uq_product_configurations_product_hash",
        ),
    )
    op.create_index(
        "ix_product_configurations_product_id",
        "product_configurations",
        ["product_id"],
    )

    # ── 9. bom ─────────────────────────────────────────────────────────────────
    op.create_table(
        "bom",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["productos.id"],
            ondelete="CASCADE",
            name="fk_bom_product_id",
        ),
        sa.UniqueConstraint("product_id", "version", name="uq_bom_product_version"),
    )
    op.create_index("ix_bom_product_id", "bom", ["product_id"])

    # ── 10. bom_items ──────────────────────────────────────────────────────────
    op.create_table(
        "bom_items",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("bom_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("component_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 4), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["bom_id"],
            ["bom.id"],
            ondelete="CASCADE",
            name="fk_bom_items_bom_id",
        ),
        sa.ForeignKeyConstraint(
            ["component_id"],
            ["productos.id"],
            name="fk_bom_items_component_id",
        ),
        sa.CheckConstraint("quantity > 0", name="ck_bom_items_qty_positive"),
    )
    op.create_index("ix_bom_items_bom_id", "bom_items", ["bom_id"])

    # ── 11. customer_contract_prices ───────────────────────────────────────────
    op.create_table(
        "customer_contract_prices",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "contract_type",
            sa.String(20),
            nullable=False,
            server_default="ARIBA",
        ),
        sa.Column("fixed_sale_price", sa.Numeric(14, 4), nullable=False),
        sa.Column(
            "currency",
            sa.String(3),
            nullable=False,
            server_default="MXN",
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
        sa.Column("last_change_notice", sa.Text(), nullable=True),
        sa.Column("last_changed_by", postgresql.UUID(as_uuid=True), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["clientes.id"],
            name="fk_customer_contract_prices_customer_id",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["productos.id"],
            name="fk_customer_contract_prices_product_id",
        ),
        sa.ForeignKeyConstraint(
            ["last_changed_by"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_customer_contract_prices_last_changed_by",
        ),
        sa.CheckConstraint(
            "contract_type IN ('ARIBA','CONTRACT_OTHER')",
            name="ck_customer_contract_prices_type",
        ),
        sa.CheckConstraint(
            "fixed_sale_price >= 0",
            name="ck_customer_contract_prices_price_positive",
        ),
    )
    op.create_index(
        "ix_customer_contract_prices_customer_product",
        "customer_contract_prices",
        ["customer_id", "product_id"],
    )
    op.create_index(
        "ix_customer_contract_prices_is_current",
        "customer_contract_prices",
        ["is_current"],
    )

    # ── 12. product_cost_history ───────────────────────────────────────────────
    op.create_table(
        "product_cost_history",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("previous_avg_cost", sa.Numeric(14, 4), nullable=True),
        sa.Column("new_avg_cost", sa.Numeric(14, 4), nullable=False),
        sa.Column("quantity_received", sa.Numeric(14, 4), nullable=True),
        sa.Column("unit_cost_of_receipt", sa.Numeric(14, 4), nullable=True),
        sa.Column("triggered_by", sa.String(20), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["productos.id"],
            ondelete="CASCADE",
            name="fk_product_cost_history_product_id",
        ),
        sa.CheckConstraint(
            "triggered_by IN ('GOODS_RECEIPT','OPENING_BALANCE','MANUAL_RECALC','NIGHTLY_REFRESH')",
            name="ck_product_cost_history_triggered_by",
        ),
    )
    op.create_index(
        "ix_product_cost_history_product_recorded",
        "product_cost_history",
        ["product_id", "recorded_at"],
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # DATA: todo lo de datos va DESPUÉS de todo el DDL
    # ═══════════════════════════════════════════════════════════════════════════

    # ── 13. Seed sat_unit_keys ─────────────────────────────────────────────────
    op.execute("""
        INSERT INTO sat_unit_keys (code, description) VALUES
        ('H87', 'Pieza'),
        ('C62', 'Unidad'),
        ('KGM', 'Kilogramo'),
        ('GRM', 'Gramo'),
        ('MGM', 'Miligramo'),
        ('TNE', 'Tonelada métrica'),
        ('MTR', 'Metro'),
        ('CMT', 'Centímetro'),
        ('MMT', 'Milímetro'),
        ('MTK', 'Metro cuadrado'),
        ('MTQ', 'Metro cúbico'),
        ('CMK', 'Centímetro cuadrado'),
        ('LTR', 'Litro'),
        ('MLT', 'Mililitro'),
        ('GL',  'Galón'),
        ('OZA', 'Onza'),
        ('LBR', 'Libra'),
        ('FT',  'Pie'),
        ('INH', 'Pulgada'),
        ('SET', 'Juego o conjunto'),
        ('PR',  'Par'),
        ('DZN', 'Docena'),
        ('KIT', 'Kit'),
        ('BX',  'Caja'),
        ('XPK', 'Paquete'),
        ('RLL', 'Rollo'),
        ('EA',  'Elemento'),
        ('E48', 'Servicio'),
        ('HUR', 'Hora'),
        ('DAY', 'Día'),
        ('MON', 'Mes'),
        ('ANN', 'Año'),
        ('ACT', 'Actividad'),
        ('A9',  'Otras unidades')
        ON CONFLICT (code) DO NOTHING
    """)

    # ── 14. Seed sat_product_keys (industrial/automatización) ─────────────────
    op.execute("""
        INSERT INTO sat_product_keys (code, description) VALUES
        ('23151501', 'Actuadores neumáticos lineales'),
        ('23151502', 'Actuadores neumáticos rotativos'),
        ('23151503', 'Actuadores hidráulicos lineales'),
        ('23151504', 'Actuadores hidráulicos rotativos'),
        ('23151700', 'Cilindros neumáticos de barra de pistón'),
        ('23151701', 'Cilindros neumáticos sin vástago'),
        ('23151702', 'Cilindros neumáticos compactos'),
        ('23161501', 'Válvulas de bola industriales'),
        ('23161502', 'Válvulas de mariposa'),
        ('23161503', 'Válvulas de compuerta'),
        ('23161504', 'Válvulas de globo'),
        ('23161600', 'Válvulas de control de flujo'),
        ('23161601', 'Válvulas solenoides'),
        ('23161602', 'Válvulas proporcionales'),
        ('23161700', 'Válvulas de seguridad y alivio'),
        ('23161900', 'Válvulas de alivio de presión'),
        ('23101702', 'Compresores de aire y gas'),
        ('23101703', 'Compresores de vacío'),
        ('23211500', 'Bombas de fluidos industriales'),
        ('23211501', 'Bombas de engranajes'),
        ('23211502', 'Bombas de pistón'),
        ('23211503', 'Bombas centrífugas'),
        ('23211504', 'Bombas de membrana'),
        ('31151501', 'Motores eléctricos de inducción'),
        ('31151502', 'Motores de corriente continua'),
        ('31151503', 'Motores sin escobillas (brushless)'),
        ('31151504', 'Motores de pasos (stepper)'),
        ('31151505', 'Servomotores'),
        ('31151506', 'Motores lineales'),
        ('32151501', 'Interruptores automáticos (breakers)'),
        ('32151502', 'Fusibles industriales'),
        ('32151503', 'Contactores eléctricos'),
        ('32151504', 'Relés industriales'),
        ('32151800', 'Variadores de frecuencia'),
        ('32151801', 'Convertidores de potencia'),
        ('32161501', 'Controladores lógicos programables (PLC)'),
        ('32161502', 'Interfaces hombre-máquina (HMI)'),
        ('32161503', 'Módulos de entradas y salidas (E/S)'),
        ('32161504', 'Controladores de movimiento'),
        ('32161505', 'Sistemas SCADA'),
        ('26111701', 'Sensores de presión'),
        ('26111702', 'Sensores de temperatura'),
        ('26111703', 'Sensores de posición y proximidad'),
        ('26111704', 'Sensores de nivel'),
        ('26111705', 'Sensores de flujo'),
        ('26111706', 'Encoders y encoders lineales'),
        ('26111707', 'Transductores industriales'),
        ('27111500', 'Conectores eléctricos industriales'),
        ('27111501', 'Terminales y borneras'),
        ('27111502', 'Cables eléctricos industriales'),
        ('27111600', 'Mangueras y tubería neumática'),
        ('27111601', 'Racores y uniones neumáticas'),
        ('27111602', 'Tubería de presión'),
        ('40101500', 'Unidades de mantenimiento FRL'),
        ('40101501', 'Filtros de aire comprimido'),
        ('40101502', 'Reguladores de presión neumática'),
        ('40101503', 'Lubricadores neumáticos'),
        ('40101600', 'Silenciadores neumáticos'),
        ('40141600', 'Herramientas neumáticas rotativas'),
        ('40141700', 'Herramientas neumáticas de percusión'),
        ('31162200', 'Mecanismos de sujeción industrial'),
        ('31162201', 'Tornillería industrial'),
        ('31162202', 'Arandelas y tuercas industriales'),
        ('31171501', 'Rodamientos de bolas'),
        ('31171502', 'Rodamientos de rodillos'),
        ('31171601', 'Cadenas de transmisión'),
        ('31171602', 'Poleas y sprockets'),
        ('31171603', 'Bandas de transmisión'),
        ('31191500', 'Sellos mecánicos industriales'),
        ('31191501', 'Empaques y juntas'),
        ('31191502', 'O-rings industriales'),
        ('44121800', 'Refacciones y consumibles industriales'),
        ('84111506', 'Servicios de mantenimiento y reparación'),
        ('80101501', 'Servicios técnicos especializados'),
        ('80141601', 'Servicios de instalación'),
        ('80141602', 'Servicios de capacitación técnica'),
        ('84111505', 'Servicios de ingeniería'),
        ('78101801', 'Servicios de flete y transporte')
        ON CONFLICT (code) DO NOTHING
    """)

    # ── 15. Permiso customer_contract_price.manage ─────────────────────────────
    op.execute("""
        INSERT INTO permissions (code, description) VALUES
        ('customer_contract_price.manage',
         'Crear y modificar convenios de precio fijo (Ariba) por cliente+producto')
        ON CONFLICT (code) DO NOTHING
    """)
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM roles r, permissions p
        WHERE r.code IN ('ADMIN', 'ACCOUNTING')
          AND p.code = 'customer_contract_price.manage'
        ON CONFLICT DO NOTHING
    """)

    # ── 16. Backfill current_avg_cost desde unit_price ─────────────────────────
    op.execute("""
        WITH updated AS (
            UPDATE productos
            SET current_avg_cost            = unit_price,
                current_avg_cost_updated_at = now()
            WHERE unit_price IS NOT NULL
              AND unit_price > 0
            RETURNING id, unit_price
        )
        INSERT INTO product_cost_history
            (product_id, previous_avg_cost, new_avg_cost, triggered_by, recorded_at)
        SELECT id, NULL, unit_price, 'OPENING_BALANCE', now()
        FROM updated
    """)

    # ── 17. Backfill slugs para categorías existentes ──────────────────────────
    op.execute("""
        UPDATE categorias
        SET slug = lower(
            regexp_replace(
                translate(
                    name,
                    'áéíóúÁÉÍÓÚàèìòùÀÈÌÒÙäëïöüÄËÏÖÜñÑ',
                    'aeiouAEIOUaeiouAEIOUaeiouAEIOUnN'
                ),
                '[^a-z0-9]+', '-', 'g'
            )
        )
        WHERE slug IS NULL
    """)
    # Sufijo numérico para slugs duplicados generados por el backfill
    op.execute("""
        WITH dups AS (
            SELECT id,
                   slug,
                   ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) AS rn
            FROM categorias
            WHERE slug IS NOT NULL
        )
        UPDATE categorias c
        SET slug = d.slug || '-' || d.rn
        FROM dups d
        WHERE c.id = d.id AND d.rn > 1
    """)


def downgrade() -> None:
    op.drop_table("product_cost_history")
    op.drop_table("customer_contract_prices")
    op.drop_table("bom_items")
    op.drop_table("bom")
    op.drop_table("product_configurations")
    op.drop_table("product_attribute_options")
    op.drop_table("product_attributes")

    op.drop_column("movimientos_inventario", "unit_cost")

    op.drop_constraint("fk_productos_sat_unit_id", "productos", type_="foreignkey")
    op.drop_constraint("fk_productos_sat_product_key_id", "productos", type_="foreignkey")
    op.drop_column("productos", "sat_unit_id")
    op.drop_column("productos", "sat_product_key_id")
    op.drop_column("productos", "is_assembled")
    op.drop_column("productos", "is_configurable")
    op.drop_column("productos", "current_avg_cost_updated_at")
    op.drop_column("productos", "current_avg_cost_currency")
    op.drop_column("productos", "current_avg_cost")
    op.drop_constraint("ck_productos_moving_avg_months", "productos", type_="check")
    op.drop_column("productos", "moving_avg_months")
    op.drop_constraint("ck_productos_pricing_strategy", "productos", type_="check")
    op.drop_column("productos", "pricing_strategy")

    op.drop_constraint("uq_categorias_slug", "categorias", type_="unique")
    op.drop_constraint("fk_categorias_parent_id", "categorias", type_="foreignkey")
    op.drop_column("categorias", "slug")
    op.drop_column("categorias", "parent_id")

    op.drop_table("sat_unit_keys")
    op.drop_table("sat_product_keys")

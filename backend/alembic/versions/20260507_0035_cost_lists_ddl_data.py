"""cost_lists_ddl_data — tablas ariba_price_list y brand_cost_list con carga desde CSV

Revision ID: 20260507_0035
Revises: 20260505_0034
Create Date: 2026-05-07
"""
from __future__ import annotations

import csv
from decimal import Decimal, InvalidOperation
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260507_0035"
down_revision = "20260505_0034"
branch_labels = None
depends_on = None

CSV_DIR = Path("/data/csv")


def _parse_decimal(raw: str) -> Decimal | None:
    if not raw or not raw.strip():
        return None
    cleaned = raw.strip().replace(",", "")
    try:
        val = Decimal(cleaned)
        return val if val > 0 else None
    except InvalidOperation:
        return None


def upgrade() -> None:
    # ── DDL ───────────────────────────────────────────────────────────────────

    op.create_table(
        "ariba_price_list",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("sku", sa.Text(), nullable=False, unique=True),
        sa.Column("sale_price", sa.Numeric(14, 4), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_ariba_price_list_sku", "ariba_price_list", ["sku"])

    op.create_table(
        "brand_cost_list",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("sku", sa.Text(), nullable=False, unique=True),
        sa.Column("cost_without_iva", sa.Numeric(14, 4), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_brand_cost_list_sku", "brand_cost_list", ["sku"])

    # ── Data ──────────────────────────────────────────────────────────────────

    bind = op.get_bind()

    # --- Costo-ariba.csv ---
    ariba_path = CSV_DIR / "Costo-ariba.csv"
    if ariba_path.exists():
        ariba_rows: dict[str, Decimal] = {}
        with ariba_path.open(newline="", encoding="utf-8-sig") as fh:
            for row in csv.DictReader(fh):
                raw_sku = row.get("property_sku.0", "")
                if not raw_sku or not raw_sku.strip():
                    continue
                sku = raw_sku.strip()
                price = _parse_decimal(row.get("property_precio_de_venta", ""))
                if price is None:
                    continue
                # First occurrence wins for duplicates
                if sku not in ariba_rows:
                    ariba_rows[sku] = price

        if ariba_rows:
            ariba_list = [{"sku": k, "sale_price": str(v)} for k, v in ariba_rows.items()]
            bind.execute(
                sa.text(
                    """
                    INSERT INTO ariba_price_list (sku, sale_price)
                    VALUES (:sku, CAST(:sale_price AS NUMERIC(14,4)))
                    ON CONFLICT (sku) DO UPDATE SET sale_price = EXCLUDED.sale_price
                    """
                ),
                ariba_list,
            )
            bind.execute(
                sa.text(
                    """
                    UPDATE productos p
                    SET purchase_cost_ariba = apl.sale_price
                    FROM ariba_price_list apl
                    WHERE UPPER(p.sku) = UPPER(apl.sku)
                    """
                )
            )

    # --- Costo-Refacciones.csv ---
    refacc_path = CSV_DIR / "Costo-Refacciones.csv"
    if refacc_path.exists():
        brand_rows: dict[str, Decimal] = {}
        with refacc_path.open(newline="", encoding="utf-8-sig") as fh:
            for row in csv.DictReader(fh):
                raw_sku = row.get("name", "")
                if not raw_sku or not raw_sku.strip():
                    continue
                sku = raw_sku.strip()
                cost = _parse_decimal(row.get("property_precio_sin_iva", ""))
                if cost is None:
                    continue
                if sku not in brand_rows:
                    brand_rows[sku] = cost

        if brand_rows:
            brand_list = [{"sku": k, "cost_without_iva": str(v)} for k, v in brand_rows.items()]
            bind.execute(
                sa.text(
                    """
                    INSERT INTO brand_cost_list (sku, cost_without_iva)
                    VALUES (:sku, CAST(:cost_without_iva AS NUMERIC(14,4)))
                    ON CONFLICT (sku) DO UPDATE SET cost_without_iva = EXCLUDED.cost_without_iva
                    """
                ),
                brand_list,
            )
            bind.execute(
                sa.text(
                    """
                    UPDATE productos p
                    SET purchase_cost_parts = bcl.cost_without_iva
                    FROM brand_cost_list bcl
                    WHERE UPPER(p.sku) = UPPER(bcl.sku)
                    """
                )
            )


def downgrade() -> None:
    op.drop_index("ix_brand_cost_list_sku", table_name="brand_cost_list")
    op.drop_table("brand_cost_list")
    op.drop_index("ix_ariba_price_list_sku", table_name="ariba_price_list")
    op.drop_table("ariba_price_list")

#!/usr/bin/env python3
"""Importa el catálogo de productos desde CSV a la BD.

Uso (dentro del contenedor backend):
    python /app/scripts/seed_productos.py
    python /app/scripts/seed_productos.py --dry-run

Estrategia de upsert: ON CONFLICT (sku) DO UPDATE.
Si SKU es vacío, se intenta por internal_code. Si ambos vacíos, se inserta con nombre.
"""
from __future__ import annotations

import csv
import os
import re
import sys
from argparse import ArgumentParser
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy import create_engine, text

CSV_PATH = "/data/csv/Catalogo_de_Productos.csv"

# Índices de columnas
COL_NOMBRE = 0
COL_SKU = 1
COL_DESC = 2
COL_STATUS = 3
COL_TIPO_VENTA = 4
COL_TAMANO_PKG = 5
COL_MARCA = 6       # UUID Notion — no usable como FK
COL_CATEGORIA = 7   # UUID Notion — no usable como FK
COL_PRECIO_UNIT = 8
COL_COSTO_REF = 9
COL_COSTO_ARIBA = 10
COL_STOCK_REAL = 11
COL_COSTO_TOTAL_STOCK = 12
COL_SALIDA_TEO = 13
COL_SALIDA_REAL = 14
COL_DEMANDA_90 = 15
COL_DEMANDA_180 = 16
COL_TOTAL_VENTA = 17
COL_FECHA_SALIDA = 18
COL_CODIGO_INT = 19


def clean(val: str) -> str:
    return re.sub(r"\s+", " ", val.strip()) if val else ""


def to_decimal(val: str) -> Decimal | None:
    v = clean(val).replace(",", "")
    if not v:
        return None
    try:
        return Decimal(v)
    except InvalidOperation:
        return None


def to_date(val: str) -> str | None:
    v = clean(val)
    if not v:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(v, fmt)
            return dt.date().isoformat()
        except ValueError:
            continue
    # Try ISO with offset like +00:00
    try:
        from datetime import timezone
        dt = datetime.fromisoformat(v)
        return dt.date().isoformat()
    except ValueError:
        return None


def parse_row(row: list[str]) -> dict | None:
    name = clean(row[COL_NOMBRE]) if len(row) > COL_NOMBRE else ""
    if not name:
        return None

    sku = clean(row[COL_SKU]) if len(row) > COL_SKU else ""
    raw_icode = clean(row[COL_CODIGO_INT]) if len(row) > COL_CODIGO_INT else ""
    # Ignorar códigos internos que son placeholders o están pendientes
    internal_code = raw_icode if raw_icode and "PENDINENTE" not in raw_icode.upper() and "PENDIENTE" not in raw_icode.upper() else ""
    description = clean(row[COL_DESC]) if len(row) > COL_DESC else ""
    status = clean(row[COL_STATUS]) if len(row) > COL_STATUS else ""
    sale_type = clean(row[COL_TIPO_VENTA]) if len(row) > COL_TIPO_VENTA else ""
    package_size = clean(row[COL_TAMANO_PKG]) if len(row) > COL_TAMANO_PKG else ""

    unit_price = to_decimal(row[COL_PRECIO_UNIT]) if len(row) > COL_PRECIO_UNIT else None
    purchase_cost_parts = to_decimal(row[COL_COSTO_REF]) if len(row) > COL_COSTO_REF else None
    purchase_cost_ariba = to_decimal(row[COL_COSTO_ARIBA]) if len(row) > COL_COSTO_ARIBA else None
    theoretical_outflow = to_decimal(row[COL_SALIDA_TEO]) if len(row) > COL_SALIDA_TEO else None
    real_outflow = to_decimal(row[COL_SALIDA_REAL]) if len(row) > COL_SALIDA_REAL else None
    demand_90 = to_decimal(row[COL_DEMANDA_90]) if len(row) > COL_DEMANDA_90 else None
    demand_180 = to_decimal(row[COL_DEMANDA_180]) if len(row) > COL_DEMANDA_180 else None
    total_sales = to_decimal(row[COL_TOTAL_VENTA]) if len(row) > COL_TOTAL_VENTA else None
    last_date = to_date(row[COL_FECHA_SALIDA]) if len(row) > COL_FECHA_SALIDA else None

    return {
        "name": name,
        "sku": sku or None,
        "internal_code": internal_code or None,
        "description": description or None,
        "status": status or None,
        "sale_type": sale_type or None,
        "package_size": package_size or None,
        "unit_price": unit_price,
        "purchase_cost_parts": purchase_cost_parts,
        "purchase_cost_ariba": purchase_cost_ariba,
        "theoretical_outflow": theoretical_outflow,
        "real_outflow": real_outflow,
        "demand_90_days": demand_90,
        "demand_180_days": demand_180,
        "total_accumulated_sales": total_sales,
        "last_outbound_date": last_date,
    }


UPSERT_SQL = text("""
    INSERT INTO productos (
        id, name, sku, internal_code, description, status, sale_type, package_size,
        unit_price, purchase_cost_parts, purchase_cost_ariba,
        theoretical_outflow, real_outflow, demand_90_days, demand_180_days,
        total_accumulated_sales, last_outbound_date,
        pricing_strategy, moving_avg_months,
        is_saleable, is_configurable, is_assembled,
        created_at, updated_at
    ) VALUES (
        gen_random_uuid(), :name, :sku, :internal_code, :description,
        :status, :sale_type, :package_size,
        :unit_price, :purchase_cost_parts, :purchase_cost_ariba,
        :theoretical_outflow, :real_outflow, :demand_90_days, :demand_180_days,
        :total_accumulated_sales, CAST(:last_outbound_date AS date),
        'MOVING_AVG', 6,
        TRUE, FALSE, FALSE,
        NOW(), NOW()
    )
    ON CONFLICT (sku) DO UPDATE SET
        name                    = EXCLUDED.name,
        internal_code           = COALESCE(EXCLUDED.internal_code, productos.internal_code),
        description             = COALESCE(EXCLUDED.description, productos.description),
        status                  = COALESCE(EXCLUDED.status, productos.status),
        sale_type               = COALESCE(EXCLUDED.sale_type, productos.sale_type),
        package_size            = COALESCE(EXCLUDED.package_size, productos.package_size),
        unit_price              = COALESCE(EXCLUDED.unit_price, productos.unit_price),
        purchase_cost_parts     = COALESCE(EXCLUDED.purchase_cost_parts, productos.purchase_cost_parts),
        purchase_cost_ariba     = COALESCE(EXCLUDED.purchase_cost_ariba, productos.purchase_cost_ariba),
        theoretical_outflow     = COALESCE(EXCLUDED.theoretical_outflow, productos.theoretical_outflow),
        real_outflow            = COALESCE(EXCLUDED.real_outflow, productos.real_outflow),
        demand_90_days          = COALESCE(EXCLUDED.demand_90_days, productos.demand_90_days),
        demand_180_days         = COALESCE(EXCLUDED.demand_180_days, productos.demand_180_days),
        total_accumulated_sales = COALESCE(EXCLUDED.total_accumulated_sales, productos.total_accumulated_sales),
        last_outbound_date      = COALESCE(EXCLUDED.last_outbound_date, productos.last_outbound_date),
        updated_at              = NOW()
""")

UPSERT_BY_NAME_SQL = text("""
    INSERT INTO productos (
        id, name, sku, internal_code, description, status, sale_type, package_size,
        unit_price, purchase_cost_parts, purchase_cost_ariba,
        theoretical_outflow, real_outflow, demand_90_days, demand_180_days,
        total_accumulated_sales, last_outbound_date,
        pricing_strategy, moving_avg_months,
        is_saleable, is_configurable, is_assembled,
        created_at, updated_at
    ) VALUES (
        gen_random_uuid(), :name, NULL, :internal_code, :description,
        :status, :sale_type, :package_size,
        :unit_price, :purchase_cost_parts, :purchase_cost_ariba,
        :theoretical_outflow, :real_outflow, :demand_90_days, :demand_180_days,
        :total_accumulated_sales, CAST(:last_outbound_date AS date),
        'MOVING_AVG', 6,
        TRUE, FALSE, FALSE,
        NOW(), NOW()
    )
    ON CONFLICT DO NOTHING
""")


def seed(dry_run: bool = False) -> None:
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        print("ERROR: DATABASE_URL no definido", file=sys.stderr)
        sys.exit(1)

    # Convertir URL async a sync si usa asyncpg; psycopg ya funciona sincrónico
    db_url = db_url.replace("+asyncpg", "")

    engine = create_engine(db_url, echo=False)

    inserted = 0
    updated = 0
    skipped = 0
    errors = 0
    total = 0

    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        next(reader)  # skip header

        rows_buffer: list[dict] = []
        for raw_row in reader:
            parsed = parse_row(raw_row)
            if parsed is None:
                skipped += 1
                continue
            rows_buffer.append(parsed)

    # Pre-procesar: deduplicar internal_code para evitar unique violations
    seen_icodes: set[str] = set()
    for row in rows_buffer:
        ic = row.get("internal_code")
        if ic:
            if ic in seen_icodes:
                row["internal_code"] = None  # descartar duplicado
            else:
                seen_icodes.add(ic)

    print(f"Filas a procesar: {len(rows_buffer)}")

    def to_params(row: dict) -> dict:
        return {
            "name": row["name"],
            "sku": row["sku"],
            "internal_code": row["internal_code"],
            "description": row["description"],
            "status": row["status"],
            "sale_type": row["sale_type"],
            "package_size": row["package_size"],
            "unit_price": float(row["unit_price"]) if row["unit_price"] is not None else None,
            "purchase_cost_parts": float(row["purchase_cost_parts"]) if row["purchase_cost_parts"] is not None else None,
            "purchase_cost_ariba": float(row["purchase_cost_ariba"]) if row["purchase_cost_ariba"] is not None else None,
            "theoretical_outflow": float(row["theoretical_outflow"]) if row["theoretical_outflow"] is not None else None,
            "real_outflow": float(row["real_outflow"]) if row["real_outflow"] is not None else None,
            "demand_90_days": float(row["demand_90_days"]) if row["demand_90_days"] is not None else None,
            "demand_180_days": float(row["demand_180_days"]) if row["demand_180_days"] is not None else None,
            "total_accumulated_sales": float(row["total_accumulated_sales"]) if row["total_accumulated_sales"] is not None else None,
            "last_outbound_date": row["last_outbound_date"],
        }

    if dry_run:
        for row in rows_buffer:
            print(f"  [DRY] SKU={row['sku']!r:30s}  {row['name'][:60]}")
        print(f"\n[DRY RUN] {len(rows_buffer)} filas se procesarían")
        return

    all_params = [to_params(r) for r in rows_buffer]
    total = len(all_params)

    with engine.connect() as conn:
        for params in all_params:
            sp = conn.begin_nested()
            try:
                if params["sku"]:
                    conn.execute(UPSERT_SQL, params)
                else:
                    conn.execute(UPSERT_BY_NAME_SQL, params)
                sp.commit()
                inserted += 1
            except Exception as exc:
                sp.rollback()
                if "internal_code" in str(exc):
                    sp2 = conn.begin_nested()
                    try:
                        retry_params = {**params, "internal_code": None}
                        if params["sku"]:
                            conn.execute(UPSERT_SQL, retry_params)
                        else:
                            conn.execute(UPSERT_BY_NAME_SQL, retry_params)
                        sp2.commit()
                        inserted += 1
                    except Exception:
                        sp2.rollback()
                        errors += 1
                else:
                    errors += 1
            if inserted % 100 == 0:
                print(f"  {inserted}/{total} procesados…", flush=True)
        conn.commit()

    print(f"\nResultado:")
    print(f"  Procesados : {total}")
    print(f"  OK         : {inserted}")
    print(f"  Errores    : {errors}")
    print(f"  Omitidos   : {skipped}")


if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    seed(dry_run=args.dry_run)

"""
Importa relaciones proveedor-producto desde Catalogo-Cross-Proveedor.csv
y actualiza costos promedio en el catálogo de productos.

Pasos:
  1. Lee y limpia el CSV (filas basura, duplicados, campos vacíos)
  2. Batch-upsert en supplier_products por (supplier_id, supplier_sku)
  3. Vincula product_id por match directo con productos.sku / internal_code
  4. Asigna unit_cost desde el último precio de PO en los últimos 6 meses
  5. Actualiza productos.current_avg_cost con promedio 6 meses

Uso:
    docker compose exec backend bash -c "cd /app && python /scripts/seed_supplier_products.py"
    docker compose exec backend bash -c "cd /app && python /scripts/seed_supplier_products.py --dry-run"
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import re
import sys
from collections import defaultdict
from pathlib import Path

# Permite ejecutar desde la raíz del proyecto, desde scripts/ o dentro del contenedor Docker
_script_parent = Path(__file__).parent
_local_backend = _script_parent.parent / "backend"
if _local_backend.exists():
    sys.path.insert(0, str(_local_backend))  # local: repo/backend
else:
    sys.path.insert(0, "/app")  # contenedor Docker: backend montado en /app

# CSV: repo/data/csv (local) o /data/csv (contenedor, montado vía docker-compose)
_local_csv = _script_parent.parent / "data" / "csv" / "Catalogo-Cross-Proveedor.csv"
CSV_PATH = _local_csv if _local_csv.exists() else Path("/data/csv/Catalogo-Cross-Proveedor.csv")

BATCH_SIZE = 500

# Patrones de nombre que identifican filas basura (no son relaciones reales)
_GARBAGE_PATTERNS = re.compile(
    r"^--"           # separadores de fecha: --2026-04-01
    r"|^-SIN"        # -SIN sku
    r"|^\s*-\s+"     # " - TAM200519PA6" o similares con solo guión
    r"|PENDIENTE"    # "PENDIENTE"-10060112
    r"|^\s*$",       # fila completamente vacía en name
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Paso 1: Leer y limpiar el CSV
# ---------------------------------------------------------------------------

def _norm(val: str | None) -> str:
    """Normaliza un valor: strip de espacios y saltos de línea."""
    if val is None:
        return ""
    return val.strip().replace("\n", "").replace("\r", "")


def load_and_clean_csv(path: Path) -> tuple[list[dict], dict[str, int]]:
    """Retorna (filas_limpias, conteo_drops).

    Cada fila limpia contiene: supplier_code, supplier_sku.
    """
    rows: list[dict] = []
    drops: dict[str, int] = defaultdict(int)
    seen: set[tuple[str, str]] = set()  # (supplier_code_upper, supplier_sku_upper)

    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            name = _norm(raw.get("name", ""))
            supplier_sku = _norm(raw.get("property_filtro", ""))
            supplier_code = _norm(raw.get("property_id_del_proveedor.0", ""))

            # — Drop: filas de separación / basura por nombre
            if _GARBAGE_PATTERNS.search(name):
                drops["nombre_basura"] += 1
                continue

            # — Drop: supplier_code vacío (no podemos vincular al proveedor)
            if not supplier_code:
                drops["sin_codigo_proveedor"] += 1
                continue

            # — Drop: supplier_sku vacío (no hay SKU que referenciar)
            if not supplier_sku:
                drops["sin_sku_proveedor"] += 1
                continue

            key = (supplier_code.upper(), supplier_sku.upper())
            if key in seen:
                drops["duplicado"] += 1
                continue

            seen.add(key)
            rows.append({"supplier_code": supplier_code, "supplier_sku": supplier_sku})

    return rows, drops


# ---------------------------------------------------------------------------
# Paso 2-5: Lógica de base de datos (operaciones batch)
# ---------------------------------------------------------------------------

async def run(dry_run: bool) -> None:
    from app.db import AsyncSessionLocal
    from sqlalchemy import text

    print(f"\n{'[DRY-RUN] ' if dry_run else ''}Cargando CSV: {CSV_PATH}")
    rows, drops = load_and_clean_csv(CSV_PATH)

    print("\n─── Reporte de limpieza CSV ───")
    total_raw = sum(drops.values()) + len(rows)
    for reason, count in sorted(drops.items(), key=lambda x: -x[1]):
        print(f"  Eliminadas ({reason}): {count}")
    print(f"  Filas válidas: {len(rows)} / {total_raw} totales")

    if not rows:
        print("No hay filas válidas. Abortando.")
        return

    async with AsyncSessionLocal() as db:

        # ── 1. Mapa supplier_code → supplier_id (una sola query) ──────────
        codes = list({r["supplier_code"] for r in rows})
        result = await db.execute(
            text("SELECT code, supplier_id FROM suppliers WHERE code = ANY(CAST(:codes AS TEXT[]))"),
            {"codes": codes},
        )
        code_to_id: dict[str, int] = {row.code: row.supplier_id for row in result}

        unknown_codes = sorted(set(codes) - set(code_to_id))
        if unknown_codes:
            print(f"\n⚠  Códigos de proveedor no encontrados en BD ({len(unknown_codes)}):")
            for c in unknown_codes[:20]:
                print(f"   · {c}")
            if len(unknown_codes) > 20:
                print(f"   … y {len(unknown_codes) - 20} más")

        valid_rows = [r for r in rows if r["supplier_code"] in code_to_id]
        skipped_no_supplier = len(rows) - len(valid_rows)
        print(f"\n  Filas con proveedor válido: {len(valid_rows)} (omitidas por proveedor faltante: {skipped_no_supplier})")

        if not valid_rows:
            print("Nada que procesar.")
            return

        # ── 2. Batch-upsert supplier_products ─────────────────────────────
        # Cargar pares (supplier_id, lower_sku) ya existentes (is_current=TRUE) en un único SELECT
        supplier_ids_used = list({code_to_id[r["supplier_code"]] for r in valid_rows})
        existing_res = await db.execute(
            text("""
                SELECT supplier_id, LOWER(TRIM(supplier_sku)) AS lower_sku
                FROM supplier_products
                WHERE is_current = TRUE
                  AND supplier_id = ANY(CAST(:sids AS BIGINT[]))
            """),
            {"sids": supplier_ids_used},
        )
        existing_pairs: set[tuple[int, str]] = {
            (row.supplier_id, row.lower_sku) for row in existing_res
        }

        to_insert = [
            r for r in valid_rows
            if (code_to_id[r["supplier_code"]], r["supplier_sku"].lower().strip()) not in existing_pairs
        ]
        already_exist = len(valid_rows) - len(to_insert)

        print(f"\n  supplier_products: {len(to_insert)} nuevas, {already_exist} ya existían")

        if to_insert and not dry_run:
            # Batch INSERT en lotes de BATCH_SIZE para no exceder límite de parámetros
            total_inserted = 0
            for i in range(0, len(to_insert), BATCH_SIZE):
                batch = to_insert[i : i + BATCH_SIZE]
                # Construir VALUES usando parámetros nombrados únicos
                placeholders = []
                params: dict = {}
                for j, r in enumerate(batch):
                    sid = code_to_id[r["supplier_code"]]
                    sku = r["supplier_sku"]
                    placeholders.append(
                        f"(CAST(:sid_{j} AS BIGINT), CAST(:sku_{j} AS TEXT), 0, CURRENT_DATE, TRUE)"
                    )
                    params[f"sid_{j}"] = sid
                    params[f"sku_{j}"] = sku

                res = await db.execute(
                    text(f"""
                        INSERT INTO supplier_products (supplier_id, supplier_sku, unit_cost, valid_from, is_current)
                        VALUES {', '.join(placeholders)}
                    """),
                    params,
                )
                total_inserted += res.rowcount

            await db.commit()
            print(f"✓ Insertadas: {total_inserted}")
        elif dry_run:
            print(f"[DRY-RUN] Se insertarían: {len(to_insert)}")

        # ── 3. Vincular product_id por match SKU directo (UPDATE batch) ───
        if not dry_run:
            match_res = await db.execute(
                text("""
                    UPDATE supplier_products sp
                    SET product_id = p.id
                    FROM productos p
                    WHERE sp.product_id IS NULL
                      AND sp.is_current = TRUE
                      AND (
                          LOWER(TRIM(COALESCE(CAST(p.sku AS TEXT), '')))
                            = LOWER(TRIM(sp.supplier_sku))
                          OR LOWER(TRIM(COALESCE(CAST(p.internal_code AS TEXT), '')))
                            = LOWER(TRIM(sp.supplier_sku))
                      )
                      AND (
                          LOWER(TRIM(COALESCE(CAST(p.sku AS TEXT), ''))) <> ''
                          OR LOWER(TRIM(COALESCE(CAST(p.internal_code AS TEXT), ''))) <> ''
                      )
                """)
            )
            await db.commit()
            print(f"✓ Productos vinculados por SKU directo: {match_res.rowcount}")
        else:
            match_res = await db.execute(
                text("""
                    SELECT COUNT(*) AS cnt
                    FROM supplier_products sp
                    JOIN productos p ON (
                        LOWER(TRIM(COALESCE(CAST(p.sku AS TEXT), '')))
                          = LOWER(TRIM(sp.supplier_sku))
                        OR LOWER(TRIM(COALESCE(CAST(p.internal_code AS TEXT), '')))
                          = LOWER(TRIM(sp.supplier_sku))
                    )
                    WHERE sp.product_id IS NULL
                      AND sp.is_current = TRUE
                """)
            )
            print(f"[DRY-RUN] Productos que se vincularían por SKU: {match_res.scalar()}")

        # ── 4. Asignar unit_cost desde última OC en 6 meses ───────────────
        if not dry_run:
            cost_res = await db.execute(
                text("""
                    UPDATE supplier_products sp
                    SET unit_cost = sub.last_cost
                    FROM (
                        SELECT DISTINCT ON (po.supplier_id, poi.product_id)
                            po.supplier_id,
                            poi.product_id,
                            poi.unit_cost AS last_cost
                        FROM purchase_order_items poi
                        JOIN purchase_orders po ON po.po_id = poi.po_id
                        WHERE poi.unit_cost > 0
                          AND poi.product_id IS NOT NULL
                          AND po.issue_date >= CURRENT_DATE - INTERVAL '6 months'
                        ORDER BY po.supplier_id, poi.product_id, po.issue_date DESC, po.po_id DESC
                    ) sub
                    WHERE sp.supplier_id = sub.supplier_id
                      AND sp.product_id = sub.product_id
                      AND sp.is_current = TRUE
                      AND sp.unit_cost = 0
                """)
            )
            await db.commit()
            print(f"✓ unit_cost asignado desde OCs (6 meses): {cost_res.rowcount} registros")
        else:
            cost_res = await db.execute(
                text("""
                    SELECT COUNT(DISTINCT sp.supplier_product_id) FROM supplier_products sp
                    JOIN (
                        SELECT DISTINCT ON (po.supplier_id, poi.product_id)
                            po.supplier_id, poi.product_id
                        FROM purchase_order_items poi
                        JOIN purchase_orders po ON po.po_id = poi.po_id
                        WHERE poi.unit_cost > 0
                          AND poi.product_id IS NOT NULL
                          AND po.issue_date >= CURRENT_DATE - INTERVAL '6 months'
                        ORDER BY po.supplier_id, poi.product_id, po.issue_date DESC
                    ) sub ON sp.supplier_id = sub.supplier_id AND sp.product_id = sub.product_id
                    WHERE sp.is_current = TRUE AND sp.unit_cost = 0
                """)
            )
            print(f"[DRY-RUN] unit_cost que se actualizaría desde OCs: {cost_res.scalar()}")

        # ── 5. Actualizar current_avg_cost con promedio 6 meses ────────────
        # Fuente 1: product_cost_history (historial de costo promedio calculado)
        if not dry_run:
            hist_res = await db.execute(
                text("""
                    UPDATE productos p
                    SET
                        current_avg_cost = sub.avg_cost,
                        current_avg_cost_updated_at = NOW()
                    FROM (
                        SELECT product_id, AVG(new_avg_cost) AS avg_cost
                        FROM product_cost_history
                        WHERE recorded_at >= NOW() - INTERVAL '6 months'
                        GROUP BY product_id
                        HAVING AVG(new_avg_cost) > 0
                    ) sub
                    WHERE p.id = sub.product_id
                """)
            )
            await db.commit()
            print(f"✓ current_avg_cost desde historial (6 meses): {hist_res.rowcount} productos")

            # Fuente 2 (fallback): purchase_order_items si no hay historial
            po_fallback_res = await db.execute(
                text("""
                    UPDATE productos p
                    SET
                        current_avg_cost = sub.avg_cost,
                        current_avg_cost_updated_at = NOW()
                    FROM (
                        SELECT poi.product_id, AVG(poi.unit_cost) AS avg_cost
                        FROM purchase_order_items poi
                        JOIN purchase_orders po ON po.po_id = poi.po_id
                        WHERE poi.unit_cost > 0
                          AND poi.product_id IS NOT NULL
                          AND po.issue_date >= CURRENT_DATE - INTERVAL '6 months'
                        GROUP BY poi.product_id
                        HAVING AVG(poi.unit_cost) > 0
                    ) sub
                    WHERE p.id = sub.product_id
                      AND (p.current_avg_cost IS NULL OR p.current_avg_cost = 0)
                """)
            )
            await db.commit()
            print(f"✓ current_avg_cost desde OCs (fallback): {po_fallback_res.rowcount} productos")

            # Registrar recálculo en product_cost_history para trazabilidad
            recalc_res = await db.execute(
                text("""
                    INSERT INTO product_cost_history
                        (product_id, previous_avg_cost, new_avg_cost, triggered_by, recorded_at)
                    SELECT
                        p.id,
                        NULL,
                        p.current_avg_cost,
                        'MANUAL_RECALC',
                        NOW()
                    FROM productos p
                    WHERE p.current_avg_cost IS NOT NULL
                      AND p.current_avg_cost > 0
                      AND p.current_avg_cost_updated_at >= NOW() - INTERVAL '1 minute'
                """)
            )
            await db.commit()
            print(f"✓ Entradas MANUAL_RECALC en product_cost_history: {recalc_res.rowcount}")

        else:
            hist_check = await db.execute(
                text("""
                    SELECT COUNT(DISTINCT product_id) FROM product_cost_history
                    WHERE recorded_at >= NOW() - INTERVAL '6 months'
                      AND new_avg_cost > 0
                """)
            )
            po_check = await db.execute(
                text("""
                    SELECT COUNT(DISTINCT poi.product_id)
                    FROM purchase_order_items poi
                    JOIN purchase_orders po ON po.po_id = poi.po_id
                    WHERE poi.unit_cost > 0
                      AND poi.product_id IS NOT NULL
                      AND po.issue_date >= CURRENT_DATE - INTERVAL '6 months'
                """)
            )
            print(f"[DRY-RUN] Productos con historial de costo (6m): {hist_check.scalar()}")
            print(f"[DRY-RUN] Productos con costo en OCs (6m): {po_check.scalar()}")

    print("\n✓ Proceso completado.\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo reporta lo que haría sin modificar la BD",
    )
    args = parser.parse_args()
    asyncio.run(run(args.dry_run))


if __name__ == "__main__":
    main()

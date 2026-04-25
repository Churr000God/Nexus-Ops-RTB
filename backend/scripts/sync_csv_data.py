from __future__ import annotations

import argparse
import importlib.util
import os
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import sqlalchemy as sa
from sqlalchemy import text

from app.models.ops_models import IncompleteOrder, InventoryMovement

BACKEND_DIR = Path(__file__).resolve().parents[1]

IMPORTER_PATH = (
    BACKEND_DIR / "alembic" / "versions" / "20260419_0002_import_csv_data.py"
)

DEFAULT_CSV_DIR = (
    Path(os.environ["CSV_DIR"])
    if os.environ.get("CSV_DIR")
    else Path("/data/csv")
    if Path("/data/csv").exists()
    else (BACKEND_DIR.parent / "data" / "csv")
)


@dataclass(frozen=True)
class DatasetSpec:
    dataset: str
    file_name: str
    handler: Callable[[sa.Connection, Iterable[dict[str, Any]]], tuple[int, int, int]]


def _load_importer_module() -> Any:
    spec = importlib.util.spec_from_file_location("csv_import", IMPORTER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"No se pudo cargar importador desde: {IMPORTER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _norm_id(row: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        val = row.get(key)
        if val is not None and str(val).strip():
            return val
    return None


def _import_inventory_movements(
    importer: Any, conn: sa.Connection, rows: Iterable[dict[str, Any]]
) -> tuple[int, int, int]:
    payloads: list[dict[str, Any]] = []
    row_count = 0

    for raw in rows:
        row_count += 1
        row = importer._normalize_row(raw)
        movement_id = importer._parse_uuid(
            _norm_id(row, "id_movimiento", "id_movimientos_inventario")
        )
        if movement_id is None:
            continue

        # "ID / movimiento" normaliza igual que "id_movimiento"; el lector lo
        # renombra a "id_movimiento_2" para preservar ambos valores.
        movement_number = _norm_id(
            row,
            "movimiento",
            "numero_de_movimiento",
            "numero_movimiento",
            "id_movimiento_2",  # alias cuando hay colisión de headers en el CSV
        )
        movement_type = _norm_id(row, "tipo_de_movimiento", "tipo", "movimiento")

        payloads.append(
            {
                "id": movement_id,
                "movement_number": movement_number,
                "product_id": None,
                "external_product_id": _norm_id(
                    row, "producto", "id_producto", "id_producto_sku"
                ),
                "movement_type": movement_type,
                "qty_in": importer._parse_decimal(
                    _norm_id(
                        row,
                        "cantidad_entrada",
                        "entrada",
                        "qty_in",
                        "cantidad_entrante",  # alias CSV actual
                    )
                ),
                "qty_out": importer._parse_decimal(
                    _norm_id(row, "cantidad_salida", "salida", "qty_out")
                ),
                "qty_nonconformity": importer._parse_decimal(
                    _norm_id(
                        row,
                        "cantidad_no_conforme",
                        "cantidad_nc",
                        "qty_nonconformity",
                        "cantidad_por_no_conformidad",  # alias CSV actual
                    )
                ),
                "moved_on": importer._parse_datetime(
                    _norm_id(row, "fecha", "fecha_de_movimiento", "fecha_y_hora")
                ),
                "origin": _norm_id(row, "origen"),
                "destination": _norm_id(row, "destino"),
                "observations": _norm_id(row, "observaciones", "notas"),
                "goods_receipt_id": importer._fk_or_none(
                    conn,
                    "entradas_mercancia",
                    importer._parse_uuid(
                        _norm_id(
                            row,
                            "entrada_mercancia",
                            "id_entrada_mercancia",
                            "referencia_entrada",  # alias CSV actual
                        )
                    ),
                ),
                "quote_item_id": importer._fk_or_none(
                    conn,
                    "cotizacion_items",
                    importer._parse_uuid(
                        _norm_id(
                            row,
                            "detalle_cotizacion",
                            "cotizacion_item",
                            "referencia_salida",  # alias CSV actual
                        )
                    ),
                ),
                "nonconformity_id": importer._fk_or_none(
                    conn,
                    "no_conformes",
                    importer._parse_uuid(
                        _norm_id(row, "no_conforme", "id_no_conforme")
                    ),
                ),
                "created_by_user_id": None,
                "raw_payload": row,
            }
        )

    created_total = 0
    updated_total = 0
    for batch in importer._chunk(payloads, 500):
        created, updated = importer._bulk_upsert(
            conn, InventoryMovement.__table__, batch, conflict_cols=["id"]
        )
        created_total += created
        updated_total += updated

    conn.execute(
        text(
            """
            UPDATE movimientos_inventario m
            SET product_id = p.id
            FROM productos p
            WHERE m.product_id IS NULL
              AND m.external_product_id IS NOT NULL
              AND (
                    p.internal_code = m.external_product_id
                 OR p.sku = m.external_product_id
              )
            """
        )
    )
    conn.execute(
        text(
            """
            UPDATE movimientos_inventario m
            SET product_id = ci.product_id
            FROM cotizacion_items ci
            WHERE m.quote_item_id = ci.id
              AND m.product_id IS NULL
              AND ci.product_id IS NOT NULL
            """
        )
    )
    return row_count, created_total, updated_total


def _import_incomplete_orders(
    importer: Any, conn: sa.Connection, rows: Iterable[dict[str, Any]]
) -> tuple[int, int, int]:
    payloads: list[dict[str, Any]] = []
    row_count = 0

    for raw in rows:
        row_count += 1
        row = importer._normalize_row(raw)
        incomplete_id = importer._parse_uuid(
            _norm_id(row, "id_pedido_incompleto", "id_incomplete_order")
        )
        if incomplete_id is None:
            continue

        payloads.append(
            {
                "id": incomplete_id,
                "name": _norm_id(row, "nombre_del_pedido", "pedido"),
                "additional_notes": _norm_id(row, "notas_adicionales", "notas"),
                "priority": _norm_id(row, "prioridad"),
                "reason": _norm_id(row, "motivo_de_incompletitud", "motivo"),
                "status": _norm_id(row, "estado"),
                "estimated_resolution_on": importer._parse_date(
                    _norm_id(row, "fecha_estimada_de_resolucion")
                ),
                "aging_days": importer._parse_int(_norm_id(row, "dias_de_aging")),
                "responsible": _norm_id(row, "responsable"),
                "responsible_user_id": None,
                "customer_order_id": importer._fk_or_none(
                    conn,
                    "pedidos_clientes",
                    importer._parse_uuid(_norm_id(row, "pedido_cliente")),
                ),
                "quote_id": importer._fk_or_none(
                    conn,
                    "cotizaciones",
                    importer._parse_uuid(_norm_id(row, "cotizacion")),
                ),
                "product_id": importer._fk_or_none(
                    conn, "productos", importer._parse_uuid(_norm_id(row, "producto"))
                ),
                "customer_final_id": _norm_id(row, "cliente_final_id", "id_cliente"),
                "missing_products": importer._parse_int(
                    _norm_id(row, "productos_faltantes")
                ),
            }
        )

    created_total = 0
    updated_total = 0
    for batch in importer._chunk(payloads, 500):
        created, updated = importer._bulk_upsert(
            conn, IncompleteOrder.__table__, batch, conflict_cols=["id"]
        )
        created_total += created
        updated_total += updated
    return row_count, created_total, updated_total


def _build_specs(importer: Any) -> dict[str, DatasetSpec]:
    return {
        "directorio_clientes_proveedores": DatasetSpec(
            dataset="directorio_clientes_proveedores",
            file_name="Directorio_Clientes_Proveedores.csv",
            handler=importer._import_directory,
        ),
        "catalogo_productos": DatasetSpec(
            dataset="catalogo_productos",
            file_name="Catalogo_de_Productos.csv",
            handler=importer._import_products,
        ),
        "inventario": DatasetSpec(
            dataset="inventario",
            file_name="Gestion_de_Inventario.csv",
            handler=importer._import_inventory,
        ),
        "bitacora_movimientos": DatasetSpec(
            dataset="bitacora_movimientos",
            file_name="Bitacora_de_Movimientos.csv",
            handler=lambda conn, rows: _import_inventory_movements(
                importer, conn, rows
            ),
        ),
        "cotizaciones": DatasetSpec(
            dataset="cotizaciones",
            file_name="Cotizaciones_a_Clientes.csv",
            handler=importer._import_quotes,
        ),
        "cotizacion_items": DatasetSpec(
            dataset="cotizacion_items",
            file_name="Detalle_de_Cotizaciones.csv",
            handler=importer._import_quote_items,
        ),
        "cotizaciones_canceladas": DatasetSpec(
            dataset="cotizaciones_canceladas",
            file_name="Cotizaciones_Canceladas.csv",
            handler=importer._import_cancelled_quotes,
        ),
        "ventas": DatasetSpec(
            dataset="ventas",
            file_name="Reporte_de_Ventas.csv",
            handler=importer._import_sales,
        ),
        "crecimiento_inventario": DatasetSpec(
            dataset="crecimiento_inventario",
            file_name="Crecimiento_de_Inventario.csv",
            handler=importer._import_inventory_growth,
        ),
        "facturas_compras": DatasetSpec(
            dataset="facturas_compras",
            file_name="Facturas_Compras.csv",
            handler=importer._import_purchase_invoices,
        ),
        "pedidos_proveedor": DatasetSpec(
            dataset="pedidos_proveedor",
            file_name="Solicitudes_A_Proveedores.csv",
            handler=importer._import_supplier_orders,
        ),
        "entradas_mercancia": DatasetSpec(
            dataset="entradas_mercancia",
            file_name="Entradas_de_Mercancia.csv",
            handler=importer._import_goods_receipts,
        ),
        "gastos_operativos": DatasetSpec(
            dataset="gastos_operativos",
            file_name="Gastos_Operativos_RTB.csv",
            handler=importer._import_operating_expenses,
        ),
        "pedidos_clientes": DatasetSpec(
            dataset="pedidos_clientes",
            file_name="Pedidos_de_Clientes.csv",
            handler=importer._import_customer_orders,
        ),
        "pedidos_incompletos": DatasetSpec(
            dataset="pedidos_incompletos",
            file_name="Pedidos_Incompletos.csv",
            handler=lambda conn, rows: _import_incomplete_orders(importer, conn, rows),
        ),
        "verificador_fechas_pedidos": DatasetSpec(
            dataset="verificador_fechas_pedidos",
            file_name="Verificador_de_Fechas_Pedidos.csv",
            handler=importer._import_order_date_verification,
        ),
        "solicitudes_material": DatasetSpec(
            dataset="solicitudes_material",
            file_name="Solicitudes_de_Material.csv",
            handler=importer._import_material_requests,
        ),
        "proveedor_productos": DatasetSpec(
            dataset="proveedor_productos",
            file_name="Proveedores_y_Productos.csv",
            handler=importer._import_supplier_products,
        ),
        "no_conformes": DatasetSpec(
            dataset="no_conformes",
            file_name="No_Conformes.csv",
            handler=importer._import_nonconformities,
        ),
    }


def _sync_dataset(
    importer: Any,
    conn: sa.Connection,
    spec: DatasetSpec,
    csv_dir: Path,
    *,
    force: bool = False,
) -> None:
    csv_path = csv_dir / spec.file_name
    sha = (
        importer._sha256(csv_path)
        if csv_path.exists() and csv_path.stat().st_size
        else None
    )

    if not force and sha and importer._already_imported(conn, spec.dataset, sha):
        print(f"[SKIP] {spec.dataset}: hash ya importado ({spec.file_name})")
        return

    run_id = importer._record_run_start(conn, spec.dataset, spec.file_name, sha)
    try:
        if not csv_path.exists() or csv_path.stat().st_size == 0:
            importer._record_run_finish(
                conn,
                run_id,
                status="success",
                row_count=0,
                inserted_count=0,
                skipped_count=0,
            )
            print(f"[OK] {spec.dataset}: archivo vacío/inexistente")
            return

        _, rows_iter = importer._read_csv_rows(csv_path)
        row_count, created_count, updated_count = spec.handler(conn, rows_iter)
        importer._record_run_finish(
            conn,
            run_id,
            status="success",
            row_count=row_count,
            inserted_count=created_count,
            skipped_count=updated_count,
        )
        print(
            f"[OK] {spec.dataset}: rows={row_count}, created={created_count}, updated={updated_count}"
        )
    except Exception as exc:  # pragma: no cover
        importer._record_run_finish(
            conn,
            run_id,
            status="failed",
            row_count=0,
            inserted_count=0,
            skipped_count=0,
            error_message=str(exc),
        )
        raise


# real_qty / theoretical_qty are Notion-pre-computed formulas; only update derived/cost fields.
_RECALC_INVENTARIO_SQL = text(
    """
    WITH costo AS (
      SELECT product_id, AVG(price) AS costo_unitario
      FROM proveedor_productos
      WHERE price IS NOT NULL AND price > 0
      GROUP BY product_id
    )
    UPDATE inventario inv
    SET
      stock_diff       = inv.theoretical_qty - inv.real_qty,
      unit_cost        = cu.costo_unitario,
      stock_total_cost = CASE
                           WHEN cu.costo_unitario IS NOT NULL
                           THEN GREATEST(inv.real_qty, 0) * cu.costo_unitario
                           ELSE NULL
                         END,
      status_real      = CASE
                           WHEN inv.real_qty > 0 THEN 'En stock'
                           WHEN inv.real_qty = 0 THEN '0'
                           ELSE 'Sin stock'
                         END
    FROM costo cu
    WHERE inv.product_id = cu.product_id
    """
)


def _recalc_inventario(conn: sa.Connection) -> None:
    result = conn.execute(_RECALC_INVENTARIO_SQL)
    print(f"[OK] inventario recalculado: {result.rowcount} filas actualizadas")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sincroniza CSVs delta hacia Postgres (upsert por ID)."
    )
    parser.add_argument(
        "--csv-dir",
        default=str(DEFAULT_CSV_DIR),
        help="Directorio donde están los CSV.",
    )
    parser.add_argument(
        "--datasets",
        nargs="*",
        default=None,
        help="Lista de datasets a procesar. Si se omite, procesa todos los conocidos.",
    )
    parser.add_argument(
        "--skip-rollups",
        action="store_true",
        help="Si se define, no ejecuta app.recompute_all_rollups() al final.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help=(
            "Reimporta todos los CSVs aunque el hash ya haya sido procesado. "
            "Usar solo para reemplazar la BD completa desde los archivos en CSV_DIR."
        ),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("Falta variable DATABASE_URL")

    csv_dir = Path(args.csv_dir).resolve()
    importer = _load_importer_module()
    specs = _build_specs(importer)

    if args.datasets:
        unknown = sorted(set(args.datasets) - set(specs.keys()))
        if unknown:
            raise ValueError(f"Datasets desconocidos: {', '.join(unknown)}")
        selected_specs = [specs[name] for name in args.datasets]
    else:
        selected_specs = list(specs.values())

    engine = sa.create_engine(db_url)
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            if args.force:
                print("[FORCE] Reimportando todos los datasets sin verificar hash.")
            for spec in selected_specs:
                _sync_dataset(
                    importer=importer,
                    conn=conn,
                    spec=spec,
                    csv_dir=csv_dir,
                    force=args.force,
                )

            if not args.skip_rollups:
                _recalc_inventario(conn)
                conn.execute(text("SELECT app.recompute_all_rollups()"))
                print("[OK] Rollups recalculados")
            trans.commit()
        except Exception:
            trans.rollback()
            raise


if __name__ == "__main__":
    main()

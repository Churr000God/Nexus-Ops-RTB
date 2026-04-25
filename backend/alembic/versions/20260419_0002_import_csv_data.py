"""import csv data into ops tables

Revision ID: 20260419_0002
Revises: f6a0e4534684
Create Date: 2026-04-19 21:25:00
"""

from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections.abc import Callable, Iterable, Iterator
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from uuid import UUID

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models import Base
from app.models.ops_models import (
    CancelledQuote,
    CsvImportRun,
    Customer,
    CustomerOrder,
    GoodsReceipt,
    InventoryGrowth,
    InventoryItem,
    MaterialRequest,
    NonConformity,
    OperatingExpense,
    OrderDateVerification,
    Product,
    PurchaseInvoice,
    Quote,
    QuoteItem,
    Sale,
    Supplier,
    SupplierOrder,
    SupplierProduct,
)


# revision identifiers, used by Alembic.
revision: str = "20260419_0002"
down_revision: str | None = "20260420_0007"
branch_labels: str | None = None
depends_on: str | None = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_key(raw: str) -> str:
    value = raw.strip()
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    return value


def _normalize_row(raw_row: dict) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for key, value in raw_row.items():
        if key is None:
            continue
        normalized[_normalize_key(str(key))] = (
            "" if value is None else str(value).strip()
        )
    return normalized


def _parse_uuid(value: str | None) -> UUID | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return UUID(value)
    except ValueError:
        return None


def _parse_decimal(value: str | None) -> Decimal | None:
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None
    raw = raw.replace("—", "")
    if "," in raw:
        parts = [part.strip() for part in raw.split(",") if part.strip()]
        if len(parts) > 1 and all(
            re.fullmatch(r"-?\d+(?:\.\d+)?%?", part) for part in parts
        ):
            raw = parts[0]
        else:
            raw = raw.replace(",", "")
    if raw.lower() in {"nan", "none", "null"}:
        return None
    raw = raw.replace("%", "")
    try:
        return Decimal(raw)
    except Exception:
        return None


def _parse_int(value: str | None) -> int | None:
    dec = _parse_decimal(value)
    if dec is None:
        return None
    try:
        return int(dec)
    except Exception:
        return None


def _parse_bool(value: str | None) -> bool | None:
    if value is None:
        return None
    raw = value.strip().lower()
    if raw in {"true", "t", "1", "si", "sí"}:
        return True
    if raw in {"false", "f", "0", "no"}:
        return False
    return None


def _parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None
    if raw.startswith("{") and '"start"' in raw:
        parsed = _parse_json(raw)
        start = parsed.get("start") if isinstance(parsed, dict) else None
        if isinstance(start, str):
            raw = start
        else:
            return None
    raw = raw.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        try:
            return datetime.strptime(raw, "%Y-%m-%d")
        except ValueError:
            return None


def _parse_date(value: str | None) -> date | None:
    dt = _parse_datetime(value)
    if dt is None:
        return None
    return dt.date()


def _parse_percent(value: str | None) -> Decimal | None:
    dec = _parse_decimal(value)
    if dec is None:
        return None
    if Decimal("0") <= dec <= Decimal("1"):
        return dec * Decimal("100")
    return dec


def _parse_json(value: str | None) -> object | None:
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None
    if raw.startswith("[") or raw.startswith("{"):
        cleaned = raw.replace('""', '"')
        try:
            return json.loads(cleaned)
        except Exception:
            return None
    return None


def _parse_json_list(value: str | None) -> list[str] | None:
    parsed = _parse_json(value)
    if isinstance(parsed, list):
        items = [str(item).strip() for item in parsed if str(item).strip()]
        return items or None
    return None


def _parse_first_list_item(value: str | None) -> str | None:
    items = _parse_json_list(value)
    if not items:
        return None
    return items[0]


def _parse_quadrimester(value: str | None) -> str | None:
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None
    match = re.search(r"(\d{4}).*?cuatrimestre\s*(\d+)", raw, flags=re.IGNORECASE)
    if match:
        return f"{match.group(1)}-C{match.group(2)}"
    match = re.search(r"(\d{4})", raw)
    if match:
        return match.group(1)
    return raw[:20]


def _read_csv_rows(file_path: Path) -> tuple[list[str], Iterator[dict]]:
    """Lee un CSV y devuelve (headers_originales, iterador_de_filas).

    Cuando dos columnas normalizan al mismo key (e.g. 'id_movimiento' y
    'ID / movimiento' → ambas 'id_movimiento'), la segunda recibe un sufijo
    numérico en el nombre de clave del dict crudo ('ID / movimiento' → se
    almacena como 'ID / movimiento_2'). Así _normalize_row produce
    'id_movimiento' (UUID, columna original) e 'id_movimiento_2' (valor
    duplicado), preservando ambos valores sin perder el primero.
    """
    encodings = ("utf-8-sig", "utf-8", "utf-16", "latin-1")
    last_exc: Exception | None = None
    for encoding in encodings:
        try:
            handle = file_path.open("r", encoding=encoding, newline="")
            plain = csv.reader(handle)

            try:
                raw_headers = next(plain)
            except StopIteration:
                handle.close()
                return ([], iter([]))

            # Construir claves únicas para el dict: sufijo _2, _3... cuando
            # dos headers normalizan al mismo key.
            seen_norm: dict[str, int] = {}
            dict_keys: list[str] = []
            for h in raw_headers:
                nk = _normalize_key(str(h)) if h else f"__empty_{len(dict_keys)}"
                count = seen_norm.get(nk, 0) + 1
                seen_norm[nk] = count
                dict_keys.append(h if count == 1 else f"{h}_{count}")

            def _iter(r=plain, keys=dict_keys, fh=handle) -> Iterator[dict]:
                try:
                    for values in r:
                        padded = list(values) + [""] * max(0, len(keys) - len(values))
                        yield dict(zip(keys, padded[: len(keys)]))
                finally:
                    fh.close()

            return (raw_headers, _iter())
        except Exception as exc:
            try:
                handle.close()
            except Exception:
                pass
            last_exc = exc
            continue
    raise RuntimeError(f"No se pudo leer CSV: {file_path}") from last_exc


def _bulk_insert_do_nothing(
    conn: sa.Connection,
    table: sa.Table,
    rows: list[dict],
    *,
    conflict_cols: list[str],
) -> tuple[int, int]:
    if not rows:
        return (0, 0)
    pk_cols = list(table.primary_key.columns)
    pk_col = pk_cols[0] if pk_cols else list(table.c)[0]
    stmt = (
        pg_insert(table)
        .values(rows)
        .on_conflict_do_nothing(index_elements=conflict_cols)
        .returning(pk_col)
    )
    result = conn.execute(stmt)
    inserted = len(result.fetchall())
    skipped = len(rows) - inserted
    return inserted, skipped


def _bulk_upsert(
    conn: sa.Connection,
    table: sa.Table,
    rows: list[dict],
    *,
    conflict_cols: list[str],
    exclude_from_update: list[str] | None = None,
) -> tuple[int, int]:
    """INSERT … ON CONFLICT DO UPDATE. Returns (created, updated).

    Automatically excludes PK columns, conflict_cols, and GENERATED ALWAYS
    columns from both INSERT values and the DO UPDATE SET clause.
    Pass exclude_from_update to protect additional unique identifiers.
    """
    if not rows:
        return (0, 0)

    # Deduplicate rows by conflict columns AND primary key — keep last occurrence.
    # PostgreSQL raises CardinalityViolation if two rows share the same conflict
    # key, and UniqueViolation if two rows share the same PK with different
    # conflict keys.
    pk_col_names = [col.name for col in table.primary_key.columns]
    seen_conflict: dict[tuple, dict] = {}
    for row in rows:
        key = tuple(row.get(c) for c in conflict_cols)
        seen_conflict[key] = row
    seen_pk: dict[tuple, dict] = {}
    for row in seen_conflict.values():
        pk_key = tuple(row.get(c) for c in pk_col_names)
        seen_pk[pk_key] = row
    rows = list(seen_pk.values())

    # Only use columns that actually exist in the DB at this migration step.
    # Model.__table__ may include columns added by later migrations.
    existing_db_cols = {col["name"] for col in sa.inspect(conn).get_columns(table.name)}

    pk_cols = {col.name for col in table.primary_key.columns}
    generated_cols = {col.name for col in table.c if col.computed is not None}
    conflict_set = set(conflict_cols)
    exclude_set = (
        pk_cols | conflict_set | generated_cols | set(exclude_from_update or [])
    )

    # Strip generated columns and non-existent columns from INSERT values.
    strip_cols = generated_cols | (set(table.c.keys()) - existing_db_cols)
    clean_rows = (
        [{k: v for k, v in row.items() if k not in strip_cols} for row in rows]
        if strip_cols
        else rows
    )

    stmt = pg_insert(table).values(clean_rows)
    update_dict = {
        col.name: stmt.excluded[col.name]
        for col in table.c
        if col.name not in exclude_set and col.name in existing_db_cols
    }
    stmt = stmt.on_conflict_do_update(
        index_elements=conflict_cols,
        set_=update_dict,
    ).returning(sa.literal_column("(xmax::text = '0')::int").label("is_insert"))
    result = conn.execute(stmt)
    rows_result = result.fetchall()
    created = sum(1 for r in rows_result if r[0] == 1)
    updated = len(rows_result) - created
    return created, updated


def _fk_or_none(
    conn: sa.Connection, table_name: str, value: UUID | None
) -> UUID | None:
    if value is None:
        return None
    exists = conn.execute(
        text(f"select 1 from {table_name} where id = :id limit 1"), {"id": value}
    ).first()
    return value if exists else None


def _record_run_start(
    conn: sa.Connection,
    dataset: str,
    source_filename: str,
    source_sha256: str | None,
) -> int:
    table = CsvImportRun.__table__
    started_at = _now()
    result = conn.execute(
        table.insert().values(
            dataset=dataset,
            source_filename=source_filename,
            source_sha256=source_sha256,
            started_at=started_at,
            status="running",
        )
    )
    run_id = int(result.inserted_primary_key[0])
    return run_id


def _record_run_finish(
    conn: sa.Connection,
    run_id: int,
    *,
    status: str,
    row_count: int | None = None,
    inserted_count: int | None = None,
    skipped_count: int | None = None,
    error_message: str | None = None,
) -> None:
    table = CsvImportRun.__table__
    conn.execute(
        table.update()
        .where(table.c.id == run_id)
        .values(
            row_count=row_count,
            inserted_count=inserted_count,
            skipped_count=skipped_count,
            finished_at=_now(),
            status=status,
            error_message=error_message,
        )
    )


def _already_imported(
    conn: sa.Connection, dataset: str, source_sha256: str | None
) -> bool:
    if source_sha256 is None:
        return False
    stmt = text(
        "select 1 from csv_import_runs where dataset = :dataset and source_sha256 = :sha and status = 'success' limit 1"
    )
    return (
        conn.execute(stmt, {"dataset": dataset, "sha": source_sha256}).first()
        is not None
    )


def _sha256(file_path: Path) -> str:
    import hashlib

    hasher = hashlib.sha256()
    with file_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def _import_directory(
    conn: sa.Connection, rows: Iterable[dict]
) -> tuple[int, int, int]:
    customer_rows: list[dict] = []
    supplier_rows: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        row_type = row.get("tipo")
        external_id = row.get("id_siglas") or row.get("id_sigla") or row.get("id")
        entity_id = _parse_uuid(row.get("id_clientes_proveedores"))
        name = row.get("nombre")
        if entity_id is None or not external_id or not name:
            continue
        base_payload = {
            "id": entity_id,
            "external_id": external_id,
            "name": name,
            "category": row.get("categoria"),
            "status": row.get("estatus"),
            "rfc": row.get("rfc"),
            "main_contact": row.get("contacto_principal"),
            "phone": row.get("telefono"),
            "email": row.get("email"),
            "address": row.get("direccion"),
            "annual_purchase": _parse_decimal(row.get("compra_anual")),
            "last_purchase_date": _parse_date(row.get("ultima_compra")),
            "avg_payment_days": _parse_decimal(row.get("tiempo_promedio_de_pago")),
        }
        if row_type and row_type.strip().lower() == "cliente":
            customer_rows.append(base_payload)
        elif row_type and row_type.strip().lower() == "proveedor":
            supplier_rows.append(base_payload)
        else:
            continue

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(customer_rows, 500):
        inserted, skipped = _bulk_upsert(
            conn, Customer.__table__, batch, conflict_cols=["external_id"]
        )
        inserted_total += inserted
        skipped_total += skipped
    for batch in _chunk(supplier_rows, 500):
        inserted, skipped = _bulk_upsert(
            conn, Supplier.__table__, batch, conflict_cols=["external_id"]
        )
        inserted_total += inserted
        skipped_total += skipped
    return row_count, inserted_total, skipped_total


def _import_products(conn: sa.Connection, rows: Iterable[dict]) -> tuple[int, int, int]:
    by_sku: list[dict] = []
    by_internal_code: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        name = row.get("nombre_del_producto") or row.get("nombre")
        if not name:
            continue
        sku = row.get("sku")
        internal_code = row.get("codigo_interno") or row.get("codigo")
        payload = {
            "sku": sku or None,
            "internal_code": internal_code or None,
            "name": name,
            "description": row.get("descripcion"),
            "status": row.get("status"),
            "sale_type": row.get("tipo_de_venta"),
            "package_size": row.get("tamano_del_paquete"),
            "brand": row.get("marca"),
            "category": row.get("categoria"),
            "unit_price": _parse_decimal(row.get("precio_unitario")),
            "purchase_cost_parts": _parse_decimal(row.get("costo_refacciones")),
            "purchase_cost_ariba": _parse_decimal(row.get("costo_ariba")),
        }
        if sku:
            # No incluir internal_code en by_sku: productos con sku se identifican por sku.
            # Si internal_code se incluyera en el INSERT, colisionaría con otros productos
            # que ya tienen ese mismo internal_code pero distinto sku (problema de calidad de datos).
            by_sku.append({**payload, "internal_code": None})
        elif internal_code:
            by_internal_code.append(payload)

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(by_sku, 500):
        inserted, skipped = _bulk_upsert(
            conn,
            Product.__table__,
            batch,
            conflict_cols=["sku"],
            exclude_from_update=["internal_code"],
        )
        inserted_total += inserted
        skipped_total += skipped
    for batch in _chunk(by_internal_code, 500):
        inserted, skipped = _bulk_upsert(
            conn,
            Product.__table__,
            batch,
            conflict_cols=["internal_code"],
            exclude_from_update=["sku"],
        )
        inserted_total += inserted
        skipped_total += skipped
    return row_count, inserted_total, skipped_total


def _import_quotes(conn: sa.Connection, rows: Iterable[dict]) -> tuple[int, int, int]:
    payloads: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        quote_id = _parse_uuid(row.get("id_cotizacion"))
        name = row.get("nombre_de_cotizacion")
        if quote_id is None or not name:
            continue
        customer_id = _fk_or_none(conn, "clientes", _parse_uuid(row.get("cliente")))
        payloads.append(
            {
                "id": quote_id,
                "name": name,
                "status": row.get("estado"),
                "order_status": row.get("estado_del_pedido"),
                "customer_id": customer_id,
                "external_customer_id": row.get("id_de_cliente") or None,
                "created_on": _parse_datetime(row.get("fecha_de_creacion")),
                "approved_on": _parse_datetime(row.get("fecha_de_aprobacion")),
                "followed_up_on": _parse_datetime(row.get("fecha_de_seguimiento")),
                "discount": _parse_decimal(row.get("descuento")),
                "shipping_cost": _parse_decimal(row.get("costo_de_envio")),
                "credit": _parse_bool(row.get("credito")),
                "months": _parse_int(row.get("meses")),
                "subtotal": _parse_decimal(row.get("subtotal")),
                "purchase_subtotal": _parse_decimal(row.get("subtotal_compra")),
                "payment_time": row.get("tiempo_de_pago"),
                "payment_type": row.get("tipo_de_pago"),
                "missing_products": _parse_int(row.get("productos_faltantes")),
                "packed_percent": _parse_percent(row.get("empacado")),
                "ariba_status": row.get("estado_ariba"),
                "customer_code": row.get("id_de_cliente"),
                "delivery_role": row.get("rol_tipo_de_entrega"),
                "packed_on": _parse_date(row.get("fecha_de_empacado")),
            }
        )

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(payloads, 500):
        inserted, skipped = _bulk_upsert(
            conn, Quote.__table__, batch, conflict_cols=["id"]
        )
        inserted_total += inserted
        skipped_total += skipped
    return row_count, inserted_total, skipped_total


def _import_quote_items(
    conn: sa.Connection, rows: Iterable[dict]
) -> tuple[int, int, int]:
    payloads: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        item_id = _parse_uuid(row.get("id_partida"))
        quote_id = _fk_or_none(
            conn, "cotizaciones", _parse_uuid(row.get("cotizacion_relacionada"))
        )
        line_external_id = row.get("id_de_detalle_partida")
        if item_id is None or quote_id is None:
            continue
        if not line_external_id:
            continue
        payloads.append(
            {
                "id": item_id,
                "quote_id": quote_id,
                "line_external_id": line_external_id,
                "status": row.get("estado"),
                "product_id": None,
                "external_product_id": row.get("producto"),
                "sku": row.get("sku"),
                "category": row.get("categoria"),
                "qty_requested": _parse_decimal(row.get("cantidad_solicitada")),
                "qty_packed": _parse_decimal(row.get("cantidad_empacada")),
                "unit_cost_purchase": _parse_decimal(
                    row.get("costo_unitario_de_compra")
                ),
                "unit_cost_sale": _parse_decimal(row.get("costo_unitario_de_venta")),
                "accumulated_sales": _parse_decimal(row.get("venta_acumulada")),
                "last_90_days": _parse_decimal(row.get("ultimos_90_dias")),
                "last_180_days": _parse_decimal(row.get("ultimos_180_dias")),
                "quote_status": row.get("estado_de_cotizacion"),
                "external_customer_id": row.get("cliente"),
                "last_updated_on": _parse_datetime(
                    row.get("fecha_de_creacion_ultima_edicion")
                ),
            }
        )

    # Deduplicate across the full list before chunking — two rows with the same
    # id or the same (quote_id, line_external_id) would violate PK / UNIQUE
    # across batches if not removed here.
    seen_id: dict = {}
    for row in payloads:
        seen_id[row["id"]] = row
    seen_line: dict = {}
    for row in seen_id.values():
        seen_line[(row["quote_id"], row["line_external_id"])] = row
    payloads = list(seen_line.values())

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(payloads, 500):
        inserted, skipped = _bulk_upsert(
            conn,
            QuoteItem.__table__,
            batch,
            conflict_cols=["id"],
        )
        inserted_total += inserted
        skipped_total += skipped

    conn.execute(
        text(
            """
            update cotizacion_items ci
            set product_id = p.id
            from productos p
            where ci.product_id is null
              and ci.sku is not null
              and p.sku = ci.sku
            """
        )
    )
    return row_count, inserted_total, skipped_total


def _import_cancelled_quotes(
    conn: sa.Connection, rows: Iterable[dict]
) -> tuple[int, int, int]:
    payloads: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        cancellation_id = _parse_uuid(row.get("id_cotizacion_cancelada"))
        if cancellation_id is None:
            continue
        payloads.append(
            {
                "id": cancellation_id,
                "quote_number": row.get("numero_de_cotizacion"),
                "cancelled_on": _parse_date(row.get("fecha_de_cancelacion")),
                "reason": row.get("motivo_de_cancelacion"),
                "quote_id": _fk_or_none(
                    conn, "cotizaciones", _parse_uuid(row.get("cotizacion_relacionada"))
                ),
                "external_customer_id": row.get("cliente"),
            }
        )

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(payloads, 500):
        inserted, skipped = _bulk_upsert(
            conn, CancelledQuote.__table__, batch, conflict_cols=["id"]
        )
        inserted_total += inserted
        skipped_total += skipped
    return row_count, inserted_total, skipped_total


def _import_sales(conn: sa.Connection, rows: Iterable[dict]) -> tuple[int, int, int]:
    payloads: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        sale_id = _parse_uuid(row.get("id_reporte_ventas"))
        name = row.get("nombre_de_venta")
        if sale_id is None or not name:
            continue
        customer_id = _fk_or_none(conn, "clientes", _parse_uuid(row.get("cliente")))
        payloads.append(
            {
                "id": sale_id,
                "name": name,
                "sold_on": _parse_datetime(row.get("fecha")),
                "customer_id": customer_id,
                "external_customer_id": row.get("cliente") or None,
                "status": row.get("estado"),
                "subtotal": _parse_decimal(row.get("subtotal")),
                "purchase_cost": _parse_decimal(row.get("costo_compra")),
                "diff_vs_po": _parse_decimal(row.get("diferencia_vs_po")),
                "packed_percent": _parse_percent(row.get("porcentaje_empacado")),
                "year_month": row.get("ano_mes"),
                "quadrimester": _parse_quadrimester(row.get("cuatrimestre")),
                "status_r": row.get("estado_r"),
                "quote_id": _fk_or_none(
                    conn, "cotizaciones", _parse_uuid(row.get("cotizacion_relacionada"))
                ),
            }
        )

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(payloads, 50):
        inserted, skipped = _bulk_upsert(
            conn, Sale.__table__, batch, conflict_cols=["id"]
        )
        inserted_total += inserted
        skipped_total += skipped
    return row_count, inserted_total, skipped_total


def _import_inventory(
    conn: sa.Connection, rows: Iterable[dict]
) -> tuple[int, int, int]:
    payloads: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        inv_id = _parse_uuid(row.get("gestion_inventario_id"))
        if inv_id is None:
            continue
        payloads.append(
            {
                "id": inv_id,
                "product_id": None,
                "external_product_id": None,
                "internal_code": row.get("codigo_interno"),
                "real_qty": _parse_decimal(row.get("cantidad_real_en_inventario")),
                "theoretical_qty": _parse_decimal(
                    row.get("cantidad_teorica_en_inventario")
                ),
                "stock_diff": _parse_decimal(row.get("diferencia_stock")),
                "unit_cost": _parse_decimal(row.get("costo_unitario")),
                "stock_total_cost": _parse_decimal(row.get("costo_total_en_stock")),
                "status_real": row.get("estado_real"),
                "stock_alert": row.get("alerta_de_stock"),
                "purchase_block": _parse_bool(row.get("bloqueo_de_compra")),
                "days_without_movement": _parse_int(row.get("dias_sin_movimiento")),
                "movement_traffic_light": row.get("semaforo_de_movimiento"),
                "aging_classification": row.get("clasificacion_de_antiguedad"),
                "rotation_classification": row.get("clasificacion_de_rotacion"),
                "abc_classification": row.get("clasificacion_abc_auto"),
                "suggested_action": row.get("accion_sugerida"),
                "last_inbound_on": _parse_date(row.get("ultima_entrada")),
                "last_outbound_on": _parse_date(row.get("ultima_salida")),
                "demand_history": row.get("demanda_historica_90_180_dias"),
                "total_accumulated_sales": _parse_decimal(
                    row.get("total_venta_acumulada")
                ),
                "processed": _parse_bool(row.get("procesado")),
                "reviewed": _parse_bool(row.get("revisado")),
                "physical_diff": _parse_decimal(row.get("diferencia_fisica")),
                "raw_payload": row,
                "updated_on": _now(),
            }
        )

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(payloads, 500):
        inserted, skipped = _bulk_upsert(
            conn, InventoryItem.__table__, batch, conflict_cols=["id"]
        )
        inserted_total += inserted
        skipped_total += skipped

    conn.execute(
        text(
            """
            update inventario i
            set product_id = p.id
            from productos p
            where i.product_id is null
              and i.internal_code is not null
              and p.internal_code = i.internal_code
            """
        )
    )
    return row_count, inserted_total, skipped_total


def _import_inventory_growth(
    conn: sa.Connection, rows: Iterable[dict]
) -> tuple[int, int, int]:
    payloads: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        growth_id = _parse_uuid(row.get("id_crecimiento_inventario"))
        name = row.get("nombre")
        if growth_id is None or not name:
            continue
        payloads.append(
            {
                "id": growth_id,
                "name": name,
                "registered_on": _parse_date(row.get("fecha_de_registro")),
                "amount": _parse_decimal(row.get("monto")),
                "growth_type": row.get("tipo_de_crecimiento_de_inventario"),
            }
        )

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(payloads, 500):
        inserted, skipped = _bulk_upsert(
            conn, InventoryGrowth.__table__, batch, conflict_cols=["id"]
        )
        inserted_total += inserted
        skipped_total += skipped
    return row_count, inserted_total, skipped_total


def _import_nonconformities(
    conn: sa.Connection, rows: Iterable[dict]
) -> tuple[int, int, int]:
    payloads: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        nc_id = _parse_uuid(row.get("id_no_conforme"))
        if nc_id is None:
            continue
        payloads.append(
            {
                "id": nc_id,
                "folio": row.get("folio"),
                "detected_on": _parse_date(row.get("fecha")),
                "quantity": _parse_decimal(row.get("cantidad")),
                "reason": row.get("motivo"),
                "action_taken": row.get("accion_tomada"),
                "adjustment_type": row.get("tipo_de_ajuste"),
                "status": row.get("estado"),
                "product_id": None,
                "external_product_id": row.get("producto"),
                "inventory_item_id": _fk_or_none(
                    conn,
                    "inventario",
                    _parse_uuid(row.get("gestion_de_inventario_relacionada")),
                ),
                "purchase_invoice_id": _fk_or_none(
                    conn,
                    "facturas_compras",
                    _parse_uuid(row.get("factura_compra_relacionada")),
                ),
                "customer_order_id": _fk_or_none(
                    conn,
                    "pedidos_clientes",
                    _parse_uuid(row.get("pedido_de_cliente_relacionado")),
                ),
                "detected_by": row.get("responsable_que_detecto"),
                "observations": row.get("observaciones"),
                "temporary_physical_location": row.get("ubicacion_fisica_temporal"),
            }
        )

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(payloads, 500):
        inserted, skipped = _bulk_upsert(
            conn, NonConformity.__table__, batch, conflict_cols=["id"]
        )
        inserted_total += inserted
        skipped_total += skipped
    conn.execute(
        text(
            """
            update no_conformes nc
            set product_id = i.product_id
            from inventario i
            where nc.inventory_item_id = i.id
              and nc.product_id is null
              and i.product_id is not null
            """
        )
    )
    return row_count, inserted_total, skipped_total


def _import_material_requests(
    conn: sa.Connection, rows: Iterable[dict]
) -> tuple[int, int, int]:
    payloads: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        req_id = _parse_uuid(row.get("id_solicitud_material"))
        if req_id is None:
            continue
        payloads.append(
            {
                "id": req_id,
                "product_id": None,
                "product_sku": row.get("producto_sku"),
                "external_product_id": row.get("producto_nombre"),
                "qty_requested": _parse_decimal(row.get("cantidad_solicitada")),
                "requested_on": _parse_date(row.get("fecha_de_solicitud")),
                "status": row.get("estado"),
                "supplier_id": None,
                "external_supplier_id": row.get("proveedor"),
                "unit_cost": _parse_decimal(row.get("costo_unitario")),
                "is_packaged": _parse_bool(row.get("solicitud_en_paquete"))
                or (_parse_decimal(row.get("tdp_tamano_del_paquete")) is not None),
                "package_size": _parse_decimal(row.get("tdp_tamano_del_paquete")),
                "days_without_movement": _parse_int(row.get("dias_sin_movimiento")),
                "blocked_by_dormant_inventory": _parse_bool(
                    row.get("bloqueo_por_inventario_dormido")
                ),
                "purchase_exception_reason": row.get("motivo_de_excepcion_de_compra"),
                "demand_history": row.get("demanda_historica_90_180_dias"),
                "last_valid_outbound_on": _parse_date(row.get("ultima_salida_valida")),
            }
        )

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(payloads, 500):
        inserted, skipped = _bulk_upsert(
            conn, MaterialRequest.__table__, batch, conflict_cols=["id"]
        )
        inserted_total += inserted
        skipped_total += skipped
    conn.execute(
        text(
            """
            update solicitudes_material sm
            set product_id = p.id
            from productos p
            where sm.product_sku = p.sku
              and sm.product_id is null
              and sm.product_sku is not null
            """
        )
    )
    return row_count, inserted_total, skipped_total


def _import_goods_receipts(
    conn: sa.Connection, rows: Iterable[dict]
) -> tuple[int, int, int]:
    payloads: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        receipt_id = _parse_uuid(row.get("id_entrada_mercancia"))
        if receipt_id is None:
            continue
        payloads.append(
            {
                "id": receipt_id,
                "entry_number": row.get("numero_de_entrada"),
                "qty_requested": _parse_decimal(row.get("cantidad_solicitada")),
                "qty_arrived": _parse_decimal(row.get("cantidad_llegada")),
                "supplier_id": None,
                "external_supplier_id": row.get("proveedor"),
                "internal_code": row.get("codigo_interno"),
                "product_id": None,
                "external_product_id": row.get("producto"),
                "unit_cost": _parse_decimal(row.get("costo_unitario")),
                "received_on": _parse_datetime(row.get("fecha_de_creacion_recepcion")),
                "physical_validation": _parse_bool(row.get("validacion_fisica")),
                "paid_on": _parse_date(row.get("fecha_de_pago")),
                "payment_status": row.get("status_de_pago"),
                "payment_type": row.get("tipo_de_pago"),
                "purchase_invoice_id": _fk_or_none(
                    conn,
                    "facturas_compras",
                    _parse_uuid(row.get("factura_relacionada")),
                ),
                "tdp": row.get("tdp"),
                "is_packaged": _parse_bool(row.get("paquete_solicitado"))
                or (row.get("tdp") is not None and str(row.get("tdp")).strip() != ""),
                "package_size": _parse_decimal(row.get("tdp")),
                "validated_by": row.get("validado_por"),
            }
        )

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(payloads, 500):
        inserted, skipped = _bulk_upsert(
            conn, GoodsReceipt.__table__, batch, conflict_cols=["id"]
        )
        inserted_total += inserted
        skipped_total += skipped
    conn.execute(
        text(
            """
            update entradas_mercancia em
            set product_id = i.product_id
            from inventario i
            where lower(em.internal_code)::uuid = i.id
              and em.product_id is null
              and em.internal_code is not null
              and lower(em.internal_code) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              and i.product_id is not null
            """
        )
    )
    return row_count, inserted_total, skipped_total


def _import_supplier_orders(
    conn: sa.Connection, rows: Iterable[dict]
) -> tuple[int, int, int]:
    payloads: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        order_id = _parse_uuid(row.get("id_solicitud_proveedor"))
        if order_id is None:
            continue
        products: list[str] = []
        for key, value in row.items():
            if key.startswith("productos_solicitados") and value:
                products.append(value)
        responsibles: list[str] = []
        for key, value in row.items():
            if key.startswith("responsable_de_seguimiento") and value:
                responsibles.append(value)

        payloads.append(
            {
                "id": order_id,
                "order_folio": row.get("folio_de_pedido"),
                "order_status": row.get("estado_del_pedido"),
                "pickup_status": row.get("estado_de_recoleccion"),
                "generated_on": _parse_datetime(row.get("fecha_de_generacion")),
                "sent_on": _parse_date(row.get("fecha_de_envio")),
                "confirmed_on": _parse_date(row.get("fecha_de_confirmacion")),
                "estimated_pickup_on": _parse_date(
                    row.get("fecha_estimada_de_recoleccion")
                ),
                "pickup_on": _parse_date(row.get("fecha_de_recoleccion")),
                "supplier_id": None,
                "external_supplier_id": row.get("proveedor"),
                "products_requested": products or None,
                "subtotal": _parse_decimal(row.get("subtotal")),
                "shipping_cost": _parse_decimal(row.get("envio")),
                "iva": _parse_decimal(row.get("iva")),
                "total": _parse_decimal(row.get("total")),
                "is_confirmed": _parse_bool(row.get("confirmado")),
                "sent_by_email": _parse_bool(row.get("enviado_por_correo")),
                "is_printed": _parse_bool(row.get("impreso")),
                "followup_responsibles": responsibles or None,
                "purchase_invoice_id": _fk_or_none(
                    conn,
                    "facturas_compras",
                    _parse_uuid(row.get("factura_compra_relacionada")),
                ),
            }
        )

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(payloads, 300):
        inserted, skipped = _bulk_upsert(
            conn, SupplierOrder.__table__, batch, conflict_cols=["id"]
        )
        inserted_total += inserted
        skipped_total += skipped
    return row_count, inserted_total, skipped_total


def _import_purchase_invoices(
    conn: sa.Connection, rows: Iterable[dict]
) -> tuple[int, int, int]:
    payloads: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        invoice_id = _parse_uuid(row.get("id_factura_compra"))
        if invoice_id is None:
            continue

        related_receipts: list[str] = []
        related_nonconformities: list[str] = []
        for key, value in row.items():
            if key.startswith("entradas_de_mercancia_relacionadas") and value:
                related_receipts.append(value)
            if key.startswith("no_conformes_relacionadas") and value:
                related_nonconformities.append(value)

        subtotal = _parse_decimal(row.get("subtotal"))
        total = _parse_decimal(row.get("total"))
        if subtotal is not None and subtotal < 0:
            continue
        if total is not None and total < 0:
            continue

        payloads.append(
            {
                "id": invoice_id,
                "quote_number": row.get("de_cotizacion"),
                "invoice_number": row.get("de_factura"),
                "supplier_id": None,
                "external_supplier_id": row.get("proveedor"),
                "supplier_rfc": _parse_first_list_item(row.get("rfc"))
                or row.get("rfc"),
                "received_on": _parse_date(row.get("fecha_de_recepcion")),
                "invoice_on": _parse_date(row.get("fecha_de_factura")),
                "paid_on": _parse_date(row.get("fecha_de_pago")),
                "shipping_insurance_discount": _parse_decimal(
                    row.get("costo_de_envio_seguro_descuento")
                ),
                "purchase_type": row.get("tipo_de_compra"),
                "payment_type": row.get("tipo_de_pago"),
                "order_status": row.get("status_del_pedido"),
                "payment_status": row.get("status_de_pago"),
                "invoice_status": row.get("estatus_de_factura"),
                "subtotal": subtotal,
                "delivered_percent": _parse_percent(row.get("porcentaje_de_entregado")),
                "related_goods_receipts": related_receipts or None,
                "review_responsible": row.get("responsable_de_revision_de_material"),
                "related_nonconformities": related_nonconformities or None,
            }
        )

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(payloads, 200):
        inserted, skipped = _bulk_upsert(
            conn, PurchaseInvoice.__table__, batch, conflict_cols=["id"]
        )
        inserted_total += inserted
        skipped_total += skipped
    return row_count, inserted_total, skipped_total


def _import_operating_expenses(
    conn: sa.Connection, rows: Iterable[dict]
) -> tuple[int, int, int]:
    payloads: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        exp_id = _parse_uuid(row.get("id_gasto_operativo"))
        concept = row.get("concepto_descripcion")
        if exp_id is None or not concept:
            continue
        payloads.append(
            {
                "id": exp_id,
                "concept": concept,
                "invoice_folio": row.get("folio_factura"),
                "subtotal": _parse_decimal(row.get("subtotal")),
                "spent_on": _parse_date(row.get("fecha")),
                "is_deductible": _parse_bool(row.get("deducible")),
                "category": row.get("categoria"),
                "payment_method": row.get("metodo_de_pago"),
                "status": row.get("estado"),
                "responsible": row.get("responsable"),
                "supplier_id": None,
                "supplier_name": None,
                "supplier_rfc": _parse_first_list_item(row.get("rfc_proveedor")),
            }
        )

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(payloads, 500):
        inserted, skipped = _bulk_upsert(
            conn, OperatingExpense.__table__, batch, conflict_cols=["id"]
        )
        inserted_total += inserted
        skipped_total += skipped
    return row_count, inserted_total, skipped_total


def _import_customer_orders(
    conn: sa.Connection, rows: Iterable[dict]
) -> tuple[int, int, int]:
    payloads: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        order_id = _parse_uuid(row.get("id_pedido_cliente"))
        name = row.get("nombre_del_pedido")
        if order_id is None or not name:
            continue
        customer_id = _fk_or_none(conn, "clientes", _parse_uuid(row.get("cliente")))
        payloads.append(
            {
                "id": order_id,
                "name": name,
                "customer_id": customer_id,
                "external_customer_id": row.get("cliente"),
                "customer_code": row.get("id_cliente"),
                "payment_type": row.get("tipo_de_pago"),
                "invoice_status": row.get("estado_de_factura"),
                "order_status": row.get("estado_de_pedido"),
                "payment_status": row.get("estatus_de_pago"),
                "ordered_on": _parse_date(row.get("fecha_de_pedido")),
                "validated_on": _parse_date(row.get("fecha_de_validacion")),
                "approved_on": _parse_date(row.get("fecha_de_aprobacion")),
                "associated_on": _parse_date(row.get("fecha_de_asociacion")),
                "shipped_on": _parse_date(row.get("fecha_de_envio")),
                "delivered_on": _parse_date(row.get("fecha_de_entrega")),
                "invoiced_on": _parse_date(row.get("fecha_de_facturacion")),
                "paid_on": _parse_date(row.get("fecha_de_pago")),
                "fulfillment_responsible": row.get("responsable_de_surtido"),
                "quote_id": _fk_or_none(
                    conn, "cotizaciones", _parse_uuid(row.get("cotizacion"))
                ),
                "has_missing_items": _parse_bool(row.get("tiene_faltante")),
                "delivery_type": row.get("tipo_de_entrega"),
                "total": _parse_decimal(row.get("total")),
                "subtotal_with_shipping": _parse_decimal(row.get("subtotal_con_envio")),
                "delivery_time_days": _parse_int(row.get("tiempo_de_entrega")),
                "payment_time_days": _parse_int(row.get("tiempos_de_pago")),
                "preparation_time_days": _parse_int(row.get("tiempos_de_preparacion")),
                "packed_percent": _parse_percent(row.get("de_pedido_empacado")),
                "raw_payload": row,
            }
        )

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(payloads, 300):
        inserted, skipped = _bulk_upsert(
            conn, CustomerOrder.__table__, batch, conflict_cols=["id"]
        )
        inserted_total += inserted
        skipped_total += skipped
    return row_count, inserted_total, skipped_total


def _import_order_date_verification(
    conn: sa.Connection, rows: Iterable[dict]
) -> tuple[int, int, int]:
    payloads: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        event_id = _parse_uuid(row.get("id_verificador_fechas"))
        if event_id is None:
            continue
        payloads.append(
            {
                "id": event_id,
                "customer_order_id": None,
                "order_name": row.get("pedido"),
                "event_type": row.get("tipo"),
                "event_date": _parse_date(row.get("fecha")),
                "event_datetime": _parse_datetime(row.get("hora")),
                "triggered_by": row.get("persona_que_activo_la_automatizacion"),
                "external_customer_id": row.get("cliente"),
                "quote_id": _fk_or_none(
                    conn, "cotizaciones", _parse_uuid(row.get("cotizacion"))
                ),
                "order_link": row.get("pedido_link"),
            }
        )

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(payloads, 500):
        inserted, skipped = _bulk_upsert(
            conn, OrderDateVerification.__table__, batch, conflict_cols=["id"]
        )
        inserted_total += inserted
        skipped_total += skipped
    return row_count, inserted_total, skipped_total


def _import_supplier_products(
    conn: sa.Connection, rows: Iterable[dict]
) -> tuple[int, int, int]:
    payloads: list[dict] = []
    row_count = 0
    for raw in rows:
        row_count += 1
        row = _normalize_row(raw)
        link_id = _parse_uuid(row.get("id_proveedor_producto"))
        if link_id is None:
            continue
        payloads.append(
            {
                "id": link_id,
                "product_id": None,
                "product_sku": row.get("id_producto_sku"),
                "product_label": row.get("producto"),
                "supplier_id": None,
                "external_supplier_id": row.get("id_del_proveedor")
                or row.get("id_del_proveedor"),
                "supplier_name": row.get("nombre_del_proveedor"),
                "price": _parse_decimal(row.get("precio")),
                "supplier_type": row.get("tipo_de_proveedor"),
                "is_available": _parse_bool(row.get("disponibilidad")),
                "created_on": _parse_datetime(
                    row.get("fecha_de_creacion_actualizacion")
                ),
                "material_request_id": _fk_or_none(
                    conn,
                    "solicitudes_material",
                    _parse_uuid(row.get("relacion_con_solicitudes_de_material")),
                ),
                "goods_receipt_id": _fk_or_none(
                    conn,
                    "entradas_mercancia",
                    _parse_uuid(row.get("relacion_con_entradas_de_mercancia")),
                ),
            }
        )

    inserted_total = 0
    skipped_total = 0
    for batch in _chunk(payloads, 500):
        inserted, skipped = _bulk_upsert(
            conn,
            SupplierProduct.__table__,
            batch,
            conflict_cols=["id"],
        )
        inserted_total += inserted
        skipped_total += skipped

    conn.execute(
        text(
            """
            delete from proveedor_productos a
            using proveedor_productos b
            where a.ctid < b.ctid
              and a.product_sku is not null
              and b.product_sku is not null
              and a.external_supplier_id is not null
              and b.external_supplier_id is not null
              and a.product_sku = b.product_sku
              and a.external_supplier_id = b.external_supplier_id
              and coalesce(a.supplier_type, '') = coalesce(b.supplier_type, '')
            """
        )
    )

    conn.execute(
        text(
            """
            update proveedor_productos sp
            set product_id = p.id
            from productos p
            where sp.product_id is null
              and sp.product_sku is not null
              and p.sku = sp.product_sku
            """
        )
    )
    conn.execute(
        text(
            """
            update proveedor_productos sp
            set supplier_id = s.id
            from proveedores s
            where sp.supplier_id is null
              and sp.external_supplier_id is not null
              and s.external_id = sp.external_supplier_id
              and (
                    sp.product_id is null
                 or not exists (
                        select 1
                        from proveedor_productos sp2
                        where sp2.product_id = sp.product_id
                          and sp2.supplier_id = s.id
                          and sp2.supplier_type = sp.supplier_type
                          and sp2.id <> sp.id
                    )
              )
            """
        )
    )
    return row_count, inserted_total, skipped_total


def _chunk(items: list[dict], size: int) -> Iterator[list[dict]]:
    for idx in range(0, len(items), size):
        yield items[idx : idx + size]


def _run_import_for_file(
    conn: sa.Connection,
    dataset: str,
    file_path: Path,
    handler: Callable[[sa.Connection, Iterable[dict]], tuple[int, int, int]],
) -> None:
    sha = _sha256(file_path) if file_path.exists() else None
    if sha and _already_imported(conn, dataset, sha):
        return

    run_id = _record_run_start(conn, dataset, file_path.name, sha)
    try:
        _, rows_iter = _read_csv_rows(file_path)
        row_count, inserted_count, skipped_count = handler(conn, rows_iter)
        _record_run_finish(
            conn,
            run_id,
            status="success",
            row_count=row_count,
            inserted_count=inserted_count,
            skipped_count=skipped_count,
        )
    except Exception:
        raise


def upgrade() -> None:
    conn = op.get_bind()
    op.execute("CREATE SCHEMA IF NOT EXISTS staging")

    inspector = sa.inspect(conn)
    if "productos" in inspector.get_table_names(schema="public"):
        op.alter_column(
            "productos",
            "sku",
            type_=sa.String(length=255),
            existing_type=sa.String(length=80),
        )
        op.alter_column(
            "productos",
            "internal_code",
            type_=sa.String(length=255),
            existing_type=sa.String(length=80),
        )
    if "cotizacion_items" in inspector.get_table_names(schema="public"):
        op.alter_column(
            "cotizacion_items",
            "category",
            type_=sa.String(length=255),
            existing_type=sa.String(length=80),
        )
    if "inventario" in inspector.get_table_names(schema="public"):
        op.alter_column(
            "inventario",
            "internal_code",
            type_=sa.String(length=255),
            existing_type=sa.String(length=80),
        )
    if "facturas_compras" in inspector.get_table_names(schema="public"):
        op.alter_column(
            "facturas_compras",
            "invoice_number",
            type_=sa.String(length=255),
            existing_type=sa.String(length=80),
        )
        op.alter_column(
            "facturas_compras",
            "quote_number",
            type_=sa.String(length=255),
            existing_type=sa.String(length=80),
        )

    Base.metadata.create_all(bind=conn, checkfirst=True)

    base_dir = Path("/data/csv")
    if not base_dir.exists():
        return

    mappings: list[
        tuple[str, str, Callable[[sa.Connection, Iterable[dict]], tuple[int, int, int]]]
    ] = [
        (
            "directorio_clientes_proveedores",
            "Directorio_Clientes_Proveedores.csv",
            _import_directory,
        ),
        ("catalogo_productos", "Catalogo_de_Productos.csv", _import_products),
        ("cotizaciones", "Cotizaciones_a_Clientes.csv", _import_quotes),
        ("cotizacion_items", "Detalle_de_Cotizaciones.csv", _import_quote_items),
        (
            "cotizaciones_canceladas",
            "Cotizaciones_Canceladas.csv",
            _import_cancelled_quotes,
        ),
        ("ventas", "Reporte_de_Ventas.csv", _import_sales),
        ("inventario", "Gestion_de_Inventario.csv", _import_inventory),
        (
            "crecimiento_inventario",
            "Crecimiento_de_Inventario.csv",
            _import_inventory_growth,
        ),
        (
            "solicitudes_material",
            "Solicitudes_de_Material.csv",
            _import_material_requests,
        ),
        ("facturas_compras", "Facturas_Compras.csv", _import_purchase_invoices),
        ("pedidos_proveedor", "Solicitudes_A_Proveedores.csv", _import_supplier_orders),
        ("entradas_mercancia", "Entradas_de_Mercancia.csv", _import_goods_receipts),
        ("gastos_operativos", "Gastos_Operativos_RTB.csv", _import_operating_expenses),
        ("pedidos_clientes", "Pedidos_de_Clientes.csv", _import_customer_orders),
        (
            "verificador_fechas_pedidos",
            "Verificador_de_Fechas_Pedidos.csv",
            _import_order_date_verification,
        ),
        (
            "proveedor_productos",
            "Proveedores_y_Productos.csv",
            _import_supplier_products,
        ),
        ("no_conformes", "No_Conformes.csv", _import_nonconformities),
    ]

    for dataset, filename, handler in mappings:
        file_path = base_dir / filename
        if not file_path.exists():
            continue
        _run_import_for_file(conn, dataset, file_path, handler)


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        text(
            "delete from csv_import_runs where dataset in ('proveedor_productos', 'verificador_fechas_pedidos', 'pedidos_clientes', 'gastos_operativos', 'facturas_compras', 'pedidos_proveedor', 'entradas_mercancia', 'solicitudes_material', 'no_conformes', 'crecimiento_inventario', 'inventario', 'ventas', 'cotizaciones_canceladas', 'cotizacion_items', 'cotizaciones', 'catalogo_productos', 'directorio_clientes_proveedores')"
        )
    )
    op.execute("DROP TABLE IF EXISTS proveedor_productos")

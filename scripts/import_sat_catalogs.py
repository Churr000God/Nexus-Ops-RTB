"""
Importa los catálogos SAT CFDI 4.0 (c_ClaveProdServ y c_ClaveUnidad)
desde el SQLite publicado por phpcfdi/resources-sat-catalogs.

Uso:
    python scripts/import_sat_catalogs.py [--db-path /ruta/catalogs.db]
    python scripts/import_sat_catalogs.py --download   # descarga automática
"""

from __future__ import annotations

import argparse
import asyncio
import bz2
import os
import shutil
import sqlite3
import sys
import tempfile
import urllib.request
from pathlib import Path

# Permite ejecutar desde la raíz del proyecto o desde scripts/
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

GITHUB_RELEASE_URL = (
    "https://github.com/phpcfdi/resources-sat-catalogs"
    "/releases/latest/download/catalogs.db.bz2"
)


def download_catalog(dest_path: Path) -> None:
    print(f"Descargando catálogos SAT desde phpcfdi...")
    bz2_path = dest_path.with_suffix(".bz2")
    urllib.request.urlretrieve(GITHUB_RELEASE_URL, bz2_path)
    print(f"  Descomprimiendo...")
    with bz2.open(bz2_path, "rb") as f_in, open(dest_path, "wb") as f_out:
        shutil.copyfileobj(f_in, f_out)
    bz2_path.unlink()
    print(f"  Listo: {dest_path} ({dest_path.stat().st_size // 1_048_576} MB)")


def extract_from_sqlite(db_path: Path) -> tuple[list[tuple], list[tuple]]:
    conn = sqlite3.connect(str(db_path))
    conn.text_factory = lambda b: b.decode("utf-8", errors="replace")
    cur = conn.cursor()

    # c_ClaveProdServ — usamos tabla cfdi_40 (CFDI 4.0)
    cur.execute("""
        SELECT id, texto
        FROM cfdi_40_productos_servicios
        WHERE texto != '' AND id != ''
        ORDER BY id
    """)
    productos = cur.fetchall()

    # c_ClaveUnidad — usamos tabla cfdi_40
    cur.execute("""
        SELECT id, texto
        FROM cfdi_40_claves_unidades
        WHERE texto != '' AND id != ''
        ORDER BY id
    """)
    unidades = cur.fetchall()

    conn.close()
    print(f"  Extraídos: {len(productos)} claves producto, {len(unidades)} claves unidad")
    return productos, unidades


async def import_to_postgres(
    productos: list[tuple], unidades: list[tuple]
) -> None:
    from app.db import AsyncSessionLocal
    from sqlalchemy import text

    BATCH = 500

    async with AsyncSessionLocal() as db:
        # Limpiar seeds anteriores
        await db.execute(text("TRUNCATE sat_product_keys, sat_unit_keys RESTART IDENTITY CASCADE"))
        await db.commit()
        print("  Tablas vaciadas.")

        # Insertar claves de unidad
        print(f"  Insertando {len(unidades)} claves de unidad...")
        for i in range(0, len(unidades), BATCH):
            batch = unidades[i : i + BATCH]
            values = [{"code": row[0], "description": row[1]} for row in batch]
            await db.execute(
                text("""
                    INSERT INTO sat_unit_keys (code, description, is_active)
                    VALUES (:code, :description, TRUE)
                    ON CONFLICT (code) DO UPDATE
                      SET description = EXCLUDED.description,
                          is_active   = TRUE
                """),
                values,
            )
        await db.commit()
        print(f"  Claves unidad OK.")

        # Insertar claves de producto/servicio en lotes
        print(f"  Insertando {len(productos)} claves de producto/servicio...")
        for i in range(0, len(productos), BATCH):
            batch = productos[i : i + BATCH]
            values = [{"code": row[0], "description": row[1]} for row in batch]
            await db.execute(
                text("""
                    INSERT INTO sat_product_keys (code, description, is_active)
                    VALUES (:code, :description, TRUE)
                    ON CONFLICT (code) DO UPDATE
                      SET description = EXCLUDED.description,
                          is_active   = TRUE
                """),
                values,
            )
            if (i // BATCH) % 20 == 0:
                pct = min(100, round((i + BATCH) / len(productos) * 100))
                print(f"    {pct}% ({i + BATCH}/{len(productos)})")
        await db.commit()
        print(f"  Claves producto OK.")


async def main(db_path: Path | None, download: bool) -> None:
    if download or db_path is None:
        tmp = Path(tempfile.mkdtemp()) / "catalogs.db"
        download_catalog(tmp)
        db_path = tmp

    if not db_path.exists():
        print(f"ERROR: No se encontró el archivo SQLite en {db_path}")
        sys.exit(1)

    print(f"Leyendo SQLite: {db_path}")
    productos, unidades = extract_from_sqlite(db_path)

    print("Importando a PostgreSQL...")
    await import_to_postgres(productos, unidades)

    print("\nImportacion completada:")
    print(f"  sat_product_keys: {len(productos)} registros")
    print(f"  sat_unit_keys:    {len(unidades)} registros")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--db-path",
        type=Path,
        default=None,
        help="Ruta al archivo catalogs.db (SQLite). Si no se indica, se descarga automáticamente.",
    )
    parser.add_argument(
        "--download",
        action="store_true",
        help="Fuerza descarga del catálogo aunque se indique --db-path.",
    )
    args = parser.parse_args()
    asyncio.run(main(args.db_path, args.download))

# ERR-0017: Colision de headers CSV en Bitacora causa perdida de UUID

**Fecha:** 2026-04-24
**Area:** backend + scripts
**Severidad:** alto
**Estado:** resuelto

## Descripcion

`bitacora_movimientos` importaba 0 registros de 8 disponibles. Sin error visible — simplemente `row_count=8, nuevos=0, actualizados=0`.

## Contexto

`Bitacora_de_Movimientos.csv` tiene dos columnas que normalizan al mismo key tras `_normalize_key`:
- Col [0] `id_movimiento` → `id_movimiento` (contiene el UUID del registro Notion)
- Col [1] `ID / movimiento` → `id_movimiento` (contiene el numero legible: `S-2295`)

`csv.DictReader` hace last-wins con headers duplicados: el UUID de col [0] queda sobrescrito por `S-2295` de col [1]. Resultado: `row.get("id_movimiento") = "S-2295"` → `_parse_uuid("S-2295") = None` → `movement_id = None` → fila saltada.

## Causa Raiz

`csv.DictReader` itera columnas de izquierda a derecha y para claves duplicadas en el dict resultado solo conserva el ultimo valor. Como la normalizacion de headers se aplica despues en `_normalize_row`, la colision ocurre antes de que el codigo pueda detectarla.

Notion exporta el UUID de la pagina en la primera columna. Columnas de relacion/formula con nombre similar (ej. `ID / movimiento`) van en columnas posteriores y normalizan igual.

## Solucion

Reemplazar `csv.DictReader` en `_read_csv_rows` por un lector manual con `csv.reader` que:
1. Lee el header row.
2. Normaliza cada header para detectar colisiones.
3. Renombra duplicados con sufijo `_2`, `_3`, etc. en la clave del dict (`'ID / movimiento'` se almacena como `'ID / movimiento_2'`).
4. Tras `_normalize_row`, el UUID queda en `id_movimiento` y el numero legible en `id_movimiento_2`.

En `_import_inventory_movements` se agregan aliases adicionales para columnas con nombre diferente al esperado:
- `id_movimiento_2` → movement_number
- `cantidad_entrante` → qty_in
- `cantidad_por_no_conformidad` → qty_nonconformity
- `referencia_entrada` → goods_receipt_id
- `referencia_salida` → quote_item_id

## Prevencion

- Notion puede exportar columnas con nombres que normalizan igual. Usar siempre `csv.reader` con deteccion de duplicados, no `DictReader` directamente.
- El UUID de la pagina Notion siempre esta en la PRIMERA columna con ese key normalizado. El sufijo `_2` preserva el valor duplicado para uso posterior.
- Al agregar un nuevo importador, verificar los headers reales del CSV con el script de inspeccion antes de asumir nombres de columna.

## Archivos Afectados

- `backend/alembic/versions/20260419_0002_import_csv_data.py` — funcion `_read_csv_rows` reescrita
- `backend/scripts/sync_csv_data.py` — funcion `_import_inventory_movements`, aliases agregados

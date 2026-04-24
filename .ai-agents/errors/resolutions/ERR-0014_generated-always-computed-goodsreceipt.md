# ERR-0014: Columnas GENERATED ALWAYS no declaradas con Computed() en GoodsReceipt

**Fecha:** 2026-04-24
**Area:** backend + db
**Severidad:** alto
**Estado:** resuelto

## Descripcion

El sync fallaba con:
```
psycopg.errors.GeneratedAlways: column "total_cost" can only be updated to DEFAULT
DETAIL: Column "total_cost" is a generated column.
```

## Contexto

`_bulk_upsert` excluye del SET del UPDATE las columnas marcadas como `col.computed is not None` en SQLAlchemy. Las columnas `total_cost`, `delivery_percent` y `qty_requested_converted` de `entradas_mercancia` son `GENERATED ALWAYS AS ... STORED` en Postgres (creadas en migracion `20260420_0003_rtb_structure.py`), pero en el modelo `GoodsReceipt` estaban declaradas como `mapped_column(Numeric(...))` normales con solo un comentario `# computed`.

## Causa Raiz

El comentario `# computed` no tiene efecto en SQLAlchemy. Sin `Computed(...)`, `col.computed` es None y `_bulk_upsert` incluye la columna en el UPDATE, lo que Postgres rechaza para columnas GENERATED ALWAYS.

## Solucion

Declarar las tres columnas con `Computed(..., persisted=True)` en `GoodsReceipt`:

```python
total_cost: Mapped[float | None] = mapped_column(
    Numeric(14, 4),
    Computed("CASE WHEN unit_cost IS NULL OR qty_requested IS NULL THEN NULL "
             "ELSE unit_cost * qty_requested END", persisted=True),
)
delivery_percent: Mapped[float | None] = mapped_column(
    Numeric(6, 4),
    Computed("CASE WHEN qty_arrived IS NULL OR qty_requested IS NULL THEN NULL "
             "ELSE qty_arrived / NULLIF(qty_requested, 0) END", persisted=True),
)
qty_requested_converted: Mapped[float | None] = mapped_column(
    Numeric(14, 4),
    Computed("CASE WHEN is_packaged THEN qty_requested * COALESCE(package_size, 1) "
             "ELSE qty_requested END", persisted=True),
)
```

## Prevencion

Toda columna `GENERATED ALWAYS AS ... STORED` en Postgres debe tener `Computed(..., persisted=True)` en el modelo SQLAlchemy correspondiente. Nunca usar solo un comentario `# computed`.

## Archivos Afectados

- `backend/app/models/ops_models.py` — clase `GoodsReceipt`, tres columnas corregidas

# Fix: Conteo de inventario no mostraba productos (2026-05-06)

Corrección de dos bugs en el módulo de Conteos Físicos (almacén): el modal defaulteaba al tipo incorrecto y el endpoint de listado era prohibitivamente lento con productos cargados.

---

## Síntomas reportados

- Al dar clic en "Nuevo Conteo" y crear uno, la página mostraba 0 líneas (sin productos).
- El browser registraba `503 Service Unavailable` en `/api/auth/refresh`.
- Error CORS en `/api/ventas/by-month` (consecuencia del backend bloqueado).

---

## Diagnóstico

### Estado real en Supabase al momento del bug

| Count ID | Tipo | Asset lines | Product lines |
|----------|------|-------------|---------------|
| `d35d35e3` (más reciente) | ASSET | 0 | 0 |
| `b56dbde6` | PRODUCT | 0 | **1535** ✓ |
| `bd77b8fb` | ASSET | 0 | 0 |
| `562a1b1c` | ASSET | 0 | 0 |

Los conteos ASSET tenían 0 líneas porque el único activo activo en la BD fue registrado *después* de crearlos (comportamiento esperado: el conteo es un snapshot del momento).

El conteo PRODUCT (`b56dbde6`) tenía correctamente 1535 líneas, pero el usuario nunca lo veía porque el modal siempre abría con tipo ASSET seleccionado.

### Bug 1 — UX: default incorrecto en el modal

`CreateCountModal.tsx` inicializaba `countType` como `"ASSET"`. El usuario hacía clic en "Crear Conteo" sin cambiar el tipo y obtenía un conteo de activos físicos, no de SKUs de inventario.

### Bug 2 — Performance: selectinload de 1535 filas en el listado

`list_physical_counts` usaba `selectinload(PhysicalCount.product_lines)` que cargaba las 1535 `product_count_lines` completas a memoria Python en **cada llamada al listado**, solo para contarlas. Con la latencia a Supabase (~80 ms/query), el endpoint tardaba **5+ segundos**. Eso provocaba que el cliente cancelara el request y disparara un refresh de token, que también tardaba, generando el 503 visible en las DevTools.

### Bug 3 — Performance: selectinload post-commit al crear un conteo

Tras insertar las 1535 filas, `create_physical_count` recargaba el conteo con `selectinload(PhysicalCount.product_lines)` para computar los totales, añadiendo ~3 segundos innecesarios a la operación.

---

## Fixes aplicados

### Fix 1 — `frontend/src/components/assets/CreateCountModal.tsx`

- `countType` ahora defaultea a `"PRODUCT"`.
- "Inventario de productos" aparece primero en la lista de opciones.
- El reset tras submit también vuelve a `"PRODUCT"`.

### Fix 2 — `backend/app/services/assets_service.py` — `list_physical_counts`

Reemplazado `selectinload` por SQL puro con subqueries de agregación:

```sql
LEFT JOIN (
    SELECT count_id,
           COUNT(*) AS total_lines,
           SUM(CASE WHEN counted_qty IS NOT NULL THEN 1 ELSE 0 END) AS counted_lines,
           SUM(CASE WHEN counted_qty IS NOT NULL
                      AND ABS(counted_qty::float - real_qty::float) > 0.001
                    THEN 1 ELSE 0 END) AS discrepancy
    FROM product_count_lines
    GROUP BY count_id
) pl ON pl.count_id = pc.id
```

Resultado: el endpoint pasa de ~5 s a < 500 ms (sin cargar líneas individuales a memoria).

### Fix 3 — `backend/app/services/assets_service.py` — `create_physical_count`

Reemplazado el `selectinload` post-commit por `SELECT COUNT(*)`:

```python
count_sql = text("SELECT COUNT(*) AS total FROM product_count_lines WHERE count_id = CAST(:cid AS UUID)")
total_lines = int((await self.db.execute(count_sql, {"cid": str(count.id)})).scalar_one())
```

Creación de un conteo de 1535 productos pasa de ~7 s a ~3-4 s.

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/assets/CreateCountModal.tsx` | Default PRODUCT, orden de opciones |
| `backend/app/services/assets_service.py` | `list_physical_counts` con SQL aggregation; `create_physical_count` sin selectinload post-commit |

---

## Nota sobre el filtro vendible/interno en la vista de detalle

El selector "Vendible + Interno / Solo Vendibles / Solo Internos" en la pantalla de detalle de un conteo **no es redundante** con el tipo de conteo del modal. Son dos niveles distintos:

- **Modal**: define el *tipo* de snapshot (productos vs. activos físicos).
- **Filtro de detalle**: filtra la *vista* mientras el usuario está contando físicamente, permitiendo enfocarse en un subconjunto (p. ej., contar primero SKUs vendibles y luego insumos internos). No altera el contenido del conteo.

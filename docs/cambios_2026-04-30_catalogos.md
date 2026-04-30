# Catálogos: Marcas, Categorías e Inventario KPI — Implementación (2026-04-30)

## Contexto

Sesión de trabajo que cubre cuatro áreas:

1. **Fix KPI Inventario** — los contadores de SKUs mostraban 500/500 porque se
   calculaban del lado del cliente sobre filas limitadas a 500.
2. **Paginación real** — tanto el Catálogo de Productos como la página de
   Almacén pasan de un límite fijo a paginación server-side (100 por página).
3. **Módulo Marcas** — carga del CSV, limpieza, inserción en DB, linkeo
   automático a productos, página CRUD completa.
4. **Módulo Categorías** — carga del CSV, limpieza, inserción en DB, página
   CRUD con árbol jerárquico, creación de subcategorías y colapso/expansión.

---

## 1 — Fix KPI Inventario

### Problema

`Inventarios.tsx` calculaba con `useMemo` los KPIs (con stock, sin stock,
stock negativo, valor total) **a partir de las filas ya cargadas en el
cliente**, que estaban limitadas a 500 registros. Con 1 535 productos en DB,
los contadores mostraban `500 Sin Stock / 500 SKUs`.

### Solución

#### Backend — `assets_schema.py`

Se agregaron 8 campos a `InventoryKpiSummaryRead`:

```python
total_vendible: int
total_interno: int
con_stock_vendible: int
sin_stock_vendible: int
stock_negativo_vendible: int
con_stock_interno: int
sin_stock_interno: int
stock_negativo_interno: int
```

#### Backend — `assets_service.py`

Se extendió la query SQL de `get_inventory_kpi_summary()` con filtros
`FILTER (WHERE is_saleable …)` para producir los 8 contadores segregados por
tipo de inventario.

#### Frontend — `types/assets.ts`

Se extendió `InventoryKpiV2` con los 8 campos nuevos.

#### Frontend — `Inventarios.tsx`

- `PAGE_SIZE = 100`, estado `page`, `useEffect` que resetea a página 0 al
  cambiar tab o filtro de estado.
- `kpisFetcher` llama `/api/inventario/kpis-v2` para obtener los contadores
  server-side.
- Las tarjetas KPI ahora leen `kpisV2.con_stock_vendible` etc. en lugar de
  computarse del lado cliente.
- Se agregó el componente `Pagination` al final de la tabla.

---

## 2 — Paginación Catálogo de Productos

### Cambios en `ProductosCatalogoPage.tsx`

- `PAGE_SIZE = 100`, estado `page` con reset automático al cambiar cualquier
  filtro.
- Fetcher pasa `limit: PAGE_SIZE, offset: page * PAGE_SIZE`.
- Se eliminó el filtro client-side `is_saleable`; ahora es parámetro
  server-side.
- `total = productsData?.total ?? 0`, `totalPages = Math.ceil(total / PAGE_SIZE)`.
- `Pagination` renderizado tanto en la vista tabla como en la vista grid.

### Cambios en `productosService.ts`

- `is_saleable?: boolean` agregado a `ProductListParams`.

---

## 3 — Módulo Marcas

### Base de Datos

**CSV origen:** `data/csv/Marcas.csv` — 226 filas (header + 225 entradas).

**Limpieza aplicada:**

| Problema | Corrección |
|---|---|
| `AUSTROMEX` ×2 | Deduplicado → ×1 |
| `FANDELI` ×2 | Deduplicado → ×1 |
| `METRON` + `METRÓN` ×3 en total | Consolidado → `METRON` ×1 |
| `EVEPURE` | → `EVERPURE` |
| `PENNSYLVANVIA` | → `PENNSYLVANIA` |
| Línea malformada `TULMEX "KLEIN"` | Corregida a `TULMEX` |
| Espacios al inicio/final | Recortados |

**Resultado:** 220 marcas únicas insertadas + 1 ya existente (Siemens) →
**221 marcas totales** en tabla `marcas`.

**INSERT ejecutado:** `data/csv/marcas_insert.sql` — `ON CONFLICT (name) DO NOTHING`.

#### Linkeo automático marcas → productos

Se ejecutó UPDATE con CTE usando coincidencia de nombre de marca como palabra
completa dentro del nombre del producto (longitud mínima 4 caracteres, búsqueda
case-insensitive):

```sql
WITH best_match AS (
  SELECT DISTINCT ON (p.id)
    p.id, m.id AS marca_id, m.name AS marca_name
  FROM productos p
  JOIN marcas m ON (
    length(m.name) >= 4 AND (
      lower(p.name) LIKE '% ' || lower(m.name)
      OR lower(p.name) LIKE '% ' || lower(m.name) || ' %'
      OR lower(p.name) LIKE lower(m.name) || ' %'
      OR lower(p.name) = lower(m.name)
    )
  )
  WHERE p.brand_id IS NULL
  ORDER BY p.id, length(m.name) DESC   -- match más largo gana
)
UPDATE productos p
SET brand_id = bm.marca_id, brand = bm.marca_name, updated_at = NOW()
FROM best_match bm
WHERE p.id = bm.product_id;
```

**Resultado:** 743 / 1 535 productos vinculados automáticamente. Los 792
restantes no contienen un nombre de marca reconocible en su descripción.

### Backend

#### `productos_pricing_schema.py`

- `BrandRead` extendido con `markup_percent: Decimal | None`.
- `BrandCreate` extendido con `markup_percent: Decimal | None = None`.
- Nuevo schema `BrandUpdate` con todos los campos opcionales.

#### `productos_service.py`

- `create_brand()` actualizado para persistir `markup_percent`.
- Nuevo método `update_brand(brand_id, data)` — actualiza solo campos
  presentes en el payload (`model_dump` implícito por campo).

#### `routers/productos.py`

- `PATCH /api/marcas/{brand_id}` — nuevo endpoint, devuelve `BrandRead`.

### Frontend

| Archivo | Cambio |
|---|---|
| `types/productos.ts` | `BrandRead` + `markup_percent`; nuevos tipos `BrandCreate`, `BrandUpdate` |
| `services/productosService.ts` | `listBrandsAll`, `createBrand`, `updateBrand` |
| `pages/catalogos/MarcasPage.tsx` | Página completa (ver sección siguiente) |

#### Página `/catalogos/marcas`

- **Tabla** con columnas: Nombre, Descripción, % Incremento, Estado.
- **Búsqueda** por nombre con filtro Activas / Todas.
- **Modal crear** — nombre (requerido), descripción, % markup, toggle activo.
- **Modal editar** — igual que crear, pre-poblado.
- **Toggle Activar / Desactivar** inline por fila.
- Errores 409 (nombre duplicado) mostrados inline en el formulario.

---

## 4 — Módulo Categorías

### Base de Datos

**CSV origen:** `data/csv/CATEGORIAS.csv` — 55 filas (header + 54 entradas).

**Limpieza aplicada:**

| Problema | Corrección |
|---|---|
| `GRIFERIA HELVEX` ×3 | Deduplicado → ×1 |
| `GRIFERIA VALMEX` ×2 | Deduplicado → ×1 |
| `ALBERCAS` ×2 | Deduplicado → ×1 |
| `ELECTROCNICOS` | → `ELECTRONICOS` |
| `GRIFERIA HASNGROE` | → `GRIFERIA HANSGROHE` |
| `CERAMICA AMERICAN STANDAR` | → `CERAMICA AMERICAN STANDARD` |
| `REFACCIONES AMERICAN STANDAR` | → `REFACCIONES AMERICAN STANDARD` |
| `REFACCIONES EXCITE ` / `GRIFERIA FISHER ` | Espacios recortados |

**Resultado:** 50 categorías nuevas + 2 existentes → **52 categorías totales**.

Todas insertadas como categorías raíz (`parent_id = NULL`). La jerarquía se
puede configurar posteriormente desde la UI.

**Nota sobre `profit_margin_percent`:** El CSV almacena decimales (0.335 = 33.5%).
Los dos registros pre-existentes usaban escala entera (20.0 = 20%). Se respetó
la escala del CSV para las nuevas entradas; la UI siempre muestra el valor como
porcentaje (`× 100`).

### Backend

No se requirieron cambios de esquema ni nuevas migraciones; los endpoints
`POST /api/categorias` y `PATCH /api/categorias/{id}` ya existían y los schemas
`CategoryCreate` / `CategoryUpdate` cubrían todos los campos necesarios.

### Frontend

| Archivo | Cambio |
|---|---|
| `types/productos.ts` | Nuevos tipos `CategoryCreate`, `CategoryUpdate` |
| `services/productosService.ts` | `listCategoriesAll`, `createCategory`, `updateCategory` |
| `pages/catalogos/CategoriasPage.tsx` | Página completa (ver sección siguiente) |

#### Página `/catalogos/categorias`

- **Tabla jerárquica** — `flattenTree()` recorre el árbol y produce filas con
  `depth`. Las filas hijo se indentan visualmente (`paddingLeft = depth × 20px`).
- **Búsqueda** con filtro Activas / Todas.
- **Colapso / expansión** — chevron `›`/`⌄` por fila con hijos. Estado en
  `collapsedIds: Set<string>`. Al buscar se ignora el colapso para que los
  resultados siempre sean visibles.
- **"Expandir todo" / "Colapsar todo"** en toolbar cuando hay categorías con hijos.
- **Modal crear** — nombre, descripción, categoría padre (dropdown jerárquico),
  % margen, toggle activo.
- **Modal editar** — igual, excluyendo del dropdown la propia categoría y sus
  descendientes para evitar ciclos.
- **Botón "+ Sub" por fila** — abre el modal de creación con el `parent_id`
  pre-seleccionado. El modal muestra un banner `Subcategoría de: NOMBRE` y
  adapta el título y el botón de confirmación.
- **Toggle Activar / Desactivar** inline.

---

## Archivos modificados

```
backend/app/routers/productos.py
backend/app/schemas/assets_schema.py
backend/app/schemas/productos_pricing_schema.py
backend/app/services/assets_service.py
backend/app/services/productos_service.py
frontend/src/pages/Inventarios.tsx
frontend/src/pages/catalogos/CategoriasPage.tsx
frontend/src/pages/catalogos/MarcasPage.tsx
frontend/src/pages/catalogos/ProductosCatalogoPage.tsx
frontend/src/services/productosService.ts
frontend/src/types/assets.ts
frontend/src/types/productos.ts
data/csv/marcas_insert.sql                    (nuevo)
docs/cambios_2026-04-30_catalogos.md          (este archivo)
docs/catalogo_marcas_categorias.md            (referencia técnica)
```

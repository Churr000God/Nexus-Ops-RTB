# Área de Catálogos — Marcas y Categorías

Referencia técnica: tablas en DB, lógica de negocio y funcionamiento de la UI.

---

## Resumen del área

La sección **Catálogos** (`/catalogos/*`) agrupa los datos maestros del
sistema: productos, marcas y categorías. Estos catálogos son la fuente de
verdad que alimenta cotizaciones, inventario, compras y facturación.

| Ruta | Página | Estado |
|---|---|---|
| `/catalogos/productos` | Catálogo de Productos | Completo |
| `/catalogos/marcas` | Catálogo de Marcas | Completo |
| `/catalogos/categorias` | Catálogo de Categorías | Completo |

---

## Base de Datos

### Tabla `marcas`

```sql
CREATE TABLE marcas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(120) NOT NULL UNIQUE,
    description     TEXT,
    markup_percent  NUMERIC(6,4),   -- decimal: 0.335 = 33.5%
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX ix_marcas_name ON marcas (name);
```

**Columnas clave:**

| Columna | Tipo | Descripción |
|---|---|---|
| `name` | VARCHAR(120) UNIQUE | Nombre normalizado en mayúsculas (convención) |
| `markup_percent` | NUMERIC(6,4) | Porcentaje de incremento sobre precio de proveedor, almacenado como decimal (0.335 = 33.5%). NULL cuando no aplica |
| `is_active` | BOOLEAN | Sólo las marcas activas aparecen en los selectores de producto |

**Relación con `productos`:**

```
marcas.id  ←──────────────────  productos.brand_id  (FK nullable)
marcas.name ←── (desnorm.)  ──  productos.brand     (VARCHAR, copia de conveniencia)
```

El campo `productos.brand` es una copia desnormalizada del nombre que se
actualiza junto con `brand_id` para evitar JOINs costosos en listados.

---

### Tabla `categorias`

```sql
CREATE TABLE categorias (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id             UUID REFERENCES categorias(id),   -- auto-referencia
    name                  VARCHAR(120) NOT NULL UNIQUE,
    slug                  TEXT UNIQUE,
    description           TEXT,
    profit_margin_percent NUMERIC(10,4),  -- decimal: 0.335 = 33.5%
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL,
    updated_at            TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX ix_categorias_name ON categorias (name);
CREATE UNIQUE INDEX uq_categorias_slug ON categorias (slug);
```

**Columnas clave:**

| Columna | Tipo | Descripción |
|---|---|---|
| `parent_id` | UUID FK (self-ref) | NULL = categoría raíz. Soporta árbol de profundidad arbitraria |
| `slug` | TEXT UNIQUE | Identificador URL-friendly, opcional. Múltiples NULL permitidos (UNIQUE en PostgreSQL no afecta NULLs) |
| `profit_margin_percent` | NUMERIC(10,4) | Margen de ganancia en decimal. 0.335 = 33.5%. Se usa en cotización para calcular precio sugerido |

**Relación con `productos`:**

```
categorias.id   ←──────────────────  productos.category_id  (FK nullable)
categorias.name ←── (desnorm.)  ──  productos.category     (VARCHAR, copia)
```

---

### Relación general de catálogos

```
categorias (jerarquía)
    │  id
    └──── category_id ──┐
                         ▼
                      productos  ────  brand_id ────▶  marcas
                         │
                         ├── inventory_movements  (stock real)
                         ├── cotizaciones_items   (ventas)
                         └── purchase_order_items (compras)
```

---

## Lógica de Negocio

### Marcas

#### Markup percent

El campo `markup_percent` permite definir un porcentaje de incremento por marca
sobre el precio base de proveedor:

```
precio_unitario_sugerido = precio_base × (1 + markup_percent)
```

Por ejemplo, con `markup_percent = 0.335`:

```
$100 × (1 + 0.335) = $133.50
```

Este valor es referencial; el precio final de cada producto puede sobreescribirse
directamente en `productos.unit_price`.

#### Activación / desactivación

Una marca inactiva (`is_active = FALSE`) no aparece en:
- El selector de marca al crear/editar un producto.
- El filtro de marca en el catálogo de productos.

Los productos ya vinculados a una marca inactiva **no se desvinculan
automáticamente**; mantienen su `brand_id` y `brand` actuales.

#### Linkeo automático marcas → productos

Al importar el CSV de marcas, se ejecutó un UPDATE masivo que buscó el nombre
de la marca como palabra completa dentro del nombre del producto:

```sql
lower(p.name) LIKE '% ' || lower(m.name)          -- al final
OR lower(p.name) LIKE '% ' || lower(m.name) || ' %' -- en el medio
OR lower(p.name) LIKE lower(m.name) || ' %'          -- al inicio
OR lower(p.name) = lower(m.name)                     -- exacto
```

Restricción: sólo marcas con `length(name) >= 4` para evitar falsos positivos
con nombres cortos (SL, LG, ERA…). Cuando varios matches existen, gana el de
nombre más largo (más específico).

**Resultado inicial:** 743 / 1 535 productos vinculados. El resto requiere
asignación manual desde el formulario de producto.

---

### Categorías

#### Jerarquía

Las categorías son un árbol auto-referenciado de profundidad ilimitada mediante
`parent_id`. El backend construye el árbol en memoria:

```python
# productos_service.py — get_categories()
# 1. Consulta todas las categorías activas (o todas con include_inactive=True)
# 2. Construye el árbol en Python agrupando por parent_id
# 3. Devuelve solo las raíces; los hijos van en .children[]
```

El endpoint `GET /api/categorias` devuelve `list[CategoryTreeNode]` donde cada
nodo lleva su lista `children` recursiva.

#### Profit margin percent

El margen de ganancia es un dato de referencia por categoría. Se utiliza para:
- Mostrar el margen esperado en reportes de rentabilidad.
- (Futuro) Calcular el precio sugerido de un producto nuevo cuando no se
  especifica precio unitario.

La escala es decimal: `0.335 = 33.5%`. La UI multiplica por 100 para mostrar
y divide por 100 al guardar.

#### Activación / desactivación

Una categoría inactiva no aparece en selectores de producto ni en filtros del
catálogo. Sus productos vinculados conservan el `category_id` actual.

Al desactivar una categoría padre **no se desactivan automáticamente sus hijos**;
cada subcategoría mantiene su estado independiente.

---

## Backend — Endpoints

### Marcas (`/api/marcas`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/marcas` | Lista marcas activas (default). `?include_inactive=true` para todas |
| `POST` | `/api/marcas` | Crea nueva marca |
| `PATCH` | `/api/marcas/{brand_id}` | Actualiza campos de una marca (parcial) |

**Schemas:**

```python
class BrandRead:
    id: UUID
    name: str
    description: str | None
    markup_percent: Decimal | None
    is_active: bool

class BrandCreate:
    name: str              # requerido, 1-120 chars
    description: str | None = None
    markup_percent: Decimal | None = None
    is_active: bool = True

class BrandUpdate:         # todos opcionales
    name: str | None
    description: str | None
    markup_percent: Decimal | None
    is_active: bool | None
```

### Categorías (`/api/categorias`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/categorias` | Árbol de categorías activas. `?include_inactive=true` para todas |
| `POST` | `/api/categorias` | Crea nueva categoría |
| `PATCH` | `/api/categorias/{category_id}` | Actualiza campos de una categoría (parcial) |

**Schemas:**

```python
class CategoryTreeNode:
    id: UUID
    parent_id: UUID | None
    name: str
    slug: str | None
    description: str | None
    profit_margin_percent: Decimal | None
    is_active: bool
    children: list[CategoryTreeNode]   # árbol recursivo

class CategoryCreate:
    name: str              # requerido, 1-120 chars
    parent_id: UUID | None = None
    slug: str | None = None
    description: str | None = None
    profit_margin_percent: Decimal | None = None  # ge=0, le=1000
    is_active: bool = True

class CategoryUpdate:      # todos opcionales
    name: str | None
    parent_id: UUID | None
    slug: str | None
    description: str | None
    profit_margin_percent: Decimal | None
    is_active: bool | None
```

---

## Frontend — Páginas

### `/catalogos/marcas` — `MarcasPage.tsx`

**Flujo de datos:**

```
useApi(listBrandsAll)  →  BrandRead[]  →  filtrado cliente  →  DataTable
```

La lista completa (activas + inactivas) se carga una sola vez y el filtrado
Activas/Todas + búsqueda por nombre se hace en cliente — el catálogo de marcas
no supera los pocos cientos de filas, por lo que no necesita paginación.

**Funciones disponibles:**

| Acción | Descripción |
|---|---|
| Nueva marca | Modal con nombre (requerido), descripción, % markup, toggle activo |
| Editar | Mismo modal pre-poblado. Botón `✎` en cada fila |
| Activar/Desactivar | Toggle inline en cada fila — PATCH inmediato |
| Buscar | Input filtra en tiempo real por nombre |
| Filtro estado | Botones Activas / Todas |

**Manejo de errores:** Los 409 Conflict (nombre duplicado) se muestran como
banner rojo inline dentro del formulario, no como toast.

---

### `/catalogos/categorias` — `CategoriasPage.tsx`

**Flujo de datos:**

```
useApi(listCategoriesAll)  →  CategoryTreeNode[]
    │
    ├─ flattenTree(tree, 0, collapsedIds)  →  { cat, depth }[]  →  DataTable
    └─ flattenTree(tree)                  →  { cat, depth }[]  →  parentMap + contadores
```

Se mantienen **dos** aplanamientos:
- `flat` — sin colapso, para `parentMap` y contadores de totales.
- `visibleFlat` — respeta `collapsedIds`, es lo que se renderiza en la tabla.

**Lógica de colapso:**

```typescript
// collapsedIds: Set<string> — IDs de categorías con hijos que están colapsadas
function flattenTree(nodes, depth = 0, collapsed = new Set()) {
  return nodes.flatMap((n) => [
    { cat: n, depth },
    ...(n.children.length > 0 && !collapsed.has(n.id)
      ? flattenTree(n.children, depth + 1, collapsed)
      : []),
  ])
}
```

Cuando hay búsqueda activa, `visibleFlat = flat` (sin colapso) para que los
resultados sean siempre visibles aunque su padre esté colapsado.

**Protección anti-ciclos en edición:**

Al editar una categoría, el dropdown de "Categoría padre" excluye la propia
categoría y todos sus descendientes mediante `getDescendantIds()`, que recorre
el subárbol recursivamente.

**Funciones disponibles:**

| Acción | Descripción |
|---|---|
| Nueva categoría | Modal raíz — nombre, descripción, padre opcional, % margen, toggle activo |
| Nueva subcategoría | Botón `+ Sub` en cada fila — abre el mismo modal con `parent_id` pre-seleccionado y contexto visual (banner violeta) |
| Editar | Modal pre-poblado. Botón `✎` en cada fila |
| Activar/Desactivar | Toggle inline — PATCH inmediato |
| Colapsar/expandir fila | Chevron `›`/`⌄` en cada fila con hijos |
| Expandir todo | Botón en toolbar — limpia `collapsedIds` |
| Colapsar todo | Botón en toolbar — añade todos los IDs padre a `collapsedIds` |
| Buscar | Input — ignora colapso al estar activo |
| Filtro estado | Botones Activas / Todas |

---

## Datos de referencia cargados en producción

### Marcas (221 total)

Cargadas desde `data/csv/Marcas.csv`. Principales:

| Marca | Productos vinculados |
|---|---|
| HELVEX | 219 |
| URREA | 79 |
| TUBOPLUS | 42 |
| COFLEX | 28 |
| SPEARS | 21 |
| CIFUNSA | 21 |
| AMANCO | 20 |
| (otras 214) | — |

### Categorías (52 total)

Cargadas desde `data/csv/CATEGORIAS.csv`. Todas son categorías raíz
(`parent_id = NULL`). La jerarquía se puede configurar desde la UI.

Categorías con margen más alto:

| Categoría | Margen |
|---|---|
| CONTROLES | 134.50% |
| REFACCIONES EXCITE | 60.00% |
| REFACCIONES VALMEX | 55.00% |
| AHORRADORES | 52.00% |
| PRODUCTO ESPECIAL | 50.00% |

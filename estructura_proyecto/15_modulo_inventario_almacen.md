# Módulo Inventario & Activos — Almacén y Equipos

## 1. Visión general

El módulo agrupa dos secciones independientes accesibles desde el sidebar bajo **"Inventario & Activos"**:

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/inventario` | `AlmacenPage` | Stock en tiempo real de productos (vendible e interno) |
| `/equipos` | `EquiposPage` | Gestión de activos físicos fijos (laptops, máquinas, etc.) |

---

## 2. Almacén (`/inventario`)

### 2.1 Fuente de datos

| Vista / Tabla | Propósito |
|---|---|
| `v_inventory_current` | Stock real calculado desde `inventory_movements` |
| `inventario` | Stock teórico (sync externo — cuando disponible) |

### 2.2 Endpoints backend

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/inventario/vendible` | Productos con `is_saleable = true` |
| `GET` | `/api/inventario/interno` | Productos con `is_saleable = false` |
| `GET` | `/api/inventario/kpis-v2` | KPIs agregados de inventario |

Todos requieren JWT (`Authorization: Bearer <token>`).

**Parámetros comunes:** `stock_status` (OK / BELOW_MIN / OUT), `limit`, `offset`.

### 2.3 Schema de respuesta — `InventoryCurrentRead`

```python
class InventoryCurrentRead(BaseModel):
    product_id: UUID
    sku: str | None
    name: str
    is_saleable: bool
    category: str | None
    quantity_on_hand: float        # stock real (inventory_movements)
    theoretical_qty: float | None  # stock teórico (tabla inventario, nullable)
    avg_unit_cost: float
    total_value: float             # quantity_on_hand × avg_unit_cost
    theoretical_value: float | None  # theoretical_qty × avg_unit_cost
    min_stock: float | None
    stock_status: str              # "OK" | "BELOW_MIN" | "OUT"
```

El campo `theoretical_qty` y `theoretical_value` se obtienen de un `LEFT JOIN` con la tabla `inventario`. Muestran `NULL` hasta que se registren datos de stock teórico.

### 2.4 Query de inventario actual

```sql
SELECT
    vc.product_id, vc.sku, vc.name, vc.is_saleable, vc.category,
    vc.quantity_on_hand, vc.avg_unit_cost, vc.total_value,
    vc.min_stock, vc.stock_status,
    i.theoretical_qty,
    CASE WHEN i.theoretical_qty IS NOT NULL
         THEN i.theoretical_qty * vc.avg_unit_cost
         ELSE NULL END AS theoretical_value
FROM v_inventory_current vc
LEFT JOIN inventario i ON i.product_id = vc.product_id
[WHERE vc.is_saleable = :is_saleable [AND stock_status = :stock_status]]
ORDER BY vc.total_value DESC
LIMIT :limit OFFSET :offset
```

### 2.5 Estructura del frontend — `AlmacenPage`

**Archivo:** `frontend/src/pages/Inventarios.tsx`

```
AlmacenPage
├── Header card (bg-white / texto oscuro)
│     "Control de Almacén · Stock en tiempo real..."
├── KPI cards (5 tarjetas, calculadas desde las filas cargadas)
│     ├── Con Stock       — quantity_on_hand > 0  (verde)
│     ├── Sin Stock       — quantity_on_hand = 0  (ámbar)
│     ├── Stock Negativo  — quantity_on_hand < 0  (rojo)
│     ├── Valor Real      — Σ total_value         (azul)
│     └── Valor Teórico   — Σ theoretical_value   (violeta)
├── Tab strip  [Inventario Vendible | Inventario Interno]
│     + select filtro por estado
└── DataTable (scroll horizontal + vertical independiente)
      Columnas: SKU · Nombre · Categoría · Stock Real ·
                Stock Teórico · Costo Prom. · Valor Real ·
                Valor Teórico · Estado
```

**KPIs** se computan con `useMemo` sobre las filas ya cargadas — sin llamada HTTP adicional.

### 2.6 Lógica de tabs

```tsx
// enabled condicional: solo carga la tab activa
const { data: vendible } = useApi(vendibleFetcher, { enabled: stockTab === "vendible" })
const { data: interno  } = useApi(internoFetcher,  { enabled: stockTab === "interno"  })
```

### 2.7 Tipo TypeScript — `InventoryCurrentItem`

```ts
export type InventoryCurrentItem = {
  product_id: string
  sku: string | null
  name: string
  is_saleable: boolean
  category: string | null
  quantity_on_hand: number
  theoretical_qty: number | null
  avg_unit_cost: number | null
  total_value: number | null
  theoretical_value: number | null
  min_stock: number | null
  stock_status: "OK" | "BELOW_MIN" | "OUT" | null
}
```

---

## 3. Equipos (`/equipos`)

### 3.1 Endpoints backend

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/assets` | Listar activos (filtros: status, asset_type, location) |
| `GET` | `/api/assets/{id}` | Detalle de un activo |
| `POST` | `/api/assets` | Crear activo |
| `PATCH` | `/api/assets/{id}` | Actualizar activo |
| `GET` | `/api/assets/{id}/components` | Componentes instalados (vía `v_asset_current_components`) |
| `GET` | `/api/assets/{id}/history` | Historial de componentes (vía `v_asset_repair_history`) |

### 3.2 Tipos de activo

```
COMPUTER · LAPTOP · PRINTER · MACHINE · VEHICLE · TOOL · OTHER
```

### 3.3 Estados de activo

```
ACTIVE · IN_REPAIR · IDLE · RETIRED · DISMANTLED
```

### 3.4 Estructura del frontend — `EquiposPage`

**Archivo:** `frontend/src/pages/EquiposPage.tsx`

```
EquiposPage
├── Header card (bg-white / texto oscuro)
│     "Gestión de Equipos · Activos físicos registrados..."
├── Filtros: select Tipo · select Estado · btn Cerrar detalle
├── DataTable principal (scroll horizontal + vertical independiente)
│     Columnas: Código · Tipo · Nombre · Ubicación · Estado ·
│               Costo Compra · Fecha Compra
└── AssetDetailPanel (aparece al seleccionar fila)
      ├── Header: código — nombre + badge estado
      ├── Tab [Componentes | Historial]
      └── DataTable de detalle (maxHeight 300px, scroll independiente)
```

---

## 4. Componente compartido — `DataTable`

**Archivo:** `frontend/src/components/common/DataTable.tsx`

### Prop `maxHeight`

Cuando se pasa `maxHeight`, el scroll horizontal y vertical quedan en el **mismo contenedor**:

```tsx
<div
  style={maxHeight ? { maxHeight } : undefined}
  className={cn("overflow-x-auto", maxHeight ? "overflow-y-auto" : "")}
>
```

Esto garantiza que el scroll de la tabla sea **independiente del scroll de la página**.

| Página | maxHeight usado |
|--------|----------------|
| AlmacenPage — tabla principal | `calc(100vh - 430px)` |
| EquiposPage — tabla principal | `calc(100vh - 320px)` |
| EquiposPage — detalle (comp/hist) | `300px` |

---

## 5. Servicio frontend — `assetsService`

**Archivo:** `frontend/src/services/assetsService.ts`

Todas las funciones reciben `token: string | null` como primer argumento.

```ts
assetsService.getVendible(token, { stock_status?, limit?, offset? }, signal?)
assetsService.getInterno(token, { stock_status?, limit?, offset? }, signal?)
assetsService.getKpisV2(token, signal?)
assetsService.listAssets(token, { status?, asset_type?, location?, limit?, offset? }, signal?)
assetsService.getComponents(token, assetId, signal?)
assetsService.getHistory(token, assetId, { limit?, offset? }, signal?)
```

El token se obtiene desde `useAuthStore((s) => s.accessToken)` (path: `@/stores/authStore`, con **s** al final).

---

## 6. Paleta de colores de KPI cards

| Tono | Uso | Clases |
|------|-----|--------|
| `green` | Con Stock | `border-emerald-500/30 bg-emerald-500/10 text-emerald-300` |
| `amber` | Sin Stock | `border-amber-500/30 bg-amber-500/10 text-amber-300` |
| `red` | Stock Negativo | `border-red-500/30 bg-red-500/10 text-red-300` |
| `blue` | Valor Real | `border-blue-500/30 bg-blue-500/10 text-blue-300` |
| `violet` | Valor Teórico | `border-violet-500/30 bg-violet-500/10 text-violet-300` |

---

## 7. Notas de implementación

- **Stock teórico vacío:** La tabla `inventario` tiene 0 filas en el estado actual (no hay sync externo configurado). Las columnas de stock/valor teórico muestran "—" hasta que se registren datos.
- **KPIs dinámicos:** Las 5 tarjetas se recalculan automáticamente al cambiar de tab (vendible ↔ interno) o al aplicar filtros, sin llamadas HTTP adicionales.
- **Scroll independiente:** El header de la tabla (`sticky top-0`) permanece fijo dentro del contenedor scrollable.

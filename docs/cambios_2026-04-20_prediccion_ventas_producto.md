# Cambios implementados — Predicción de Ventas por Producto (2026-04-20)

## Contexto

Se implementó una nueva gráfica en el dashboard de Ventas que estima la demanda mensual esperada por producto usando un promedio móvil de los últimos N meses. La funcionalidad cubre backend (endpoint + lógica SQL), frontend (visualización) y documentación técnica.

---

## Resumen ejecutivo

- Nuevo endpoint `GET /api/ventas/product-forecast` con promedio móvil configurable.
- Corrección de error `AmbiguousParameter` de psycopg3 al pasar parámetros `NULL` sin tipo explícito.
- Filtro corregido: solo se cuentan productos cuya cotización está en estado **Aprobada**.
- Nueva gráfica de barras horizontales en el dashboard de Ventas con ranking lateral.
- Documentación técnica de la métrica en `docs/prediccion_ventas_por_producto.md`.

---

## Backend (API + lógica)

### 1) Nuevo esquema de respuesta

Se agregó `SalesForecastByProductResponse` en `venta_schema.py`:

```python
class SalesForecastByProductResponse(BaseModel):
    product: str
    sku: str | None = None
    category: str | None = None
    predicted_units: float
```

Archivo:
- `backend/app/schemas/venta_schema.py`

---

### 2) Nuevo método `sales_forecast_by_product`

Implementado en `VentasService`. Lógica en 3 CTEs:

- **`ventas_producto_mes`**: agrupa `cotizacion_items` por producto y mes calendario, sumando `COALESCE(qty_packed, qty_requested, 0)`. La fecha del mes usa `COALESCE(v.sold_on, q.approved_on, q.created_on)`.
- **`ranked`**: numera los meses por producto de más reciente a más antiguo con `ROW_NUMBER() OVER (PARTITION BY product_id, sku, category ORDER BY mes DESC)`.
- **`forecast`**: promedia las unidades de los últimos `months_window` meses (`WHERE rn <= :months_window`).

Parámetros:

| Param | Default | Descripción |
|---|---|---|
| `start_date` | `null` | Inicio del rango histórico |
| `end_date` | `null` | Fin del rango histórico |
| `months_window` | `3` | Meses a promediar |
| `limit` | `15` | Máximo de productos devueltos |

Archivo:
- `backend/app/services/ventas_service.py`

---

### 3) Corrección de error `AmbiguousParameter` (psycopg3)

Al ejecutar `text()` con parámetros `None` (NULL), psycopg3 no puede inferir el tipo de dato de `$1` y lanza `psycopg.errors.AmbiguousParameter`.

**Solución**: usar `text(...).bindparams()` con tipos SQLAlchemy explícitos:

```python
sql = text("...").bindparams(
    bindparam("start_date", type_=Date()),
    bindparam("end_date", type_=Date()),
    bindparam("months_window", type_=Integer()),
    bindparam("limit", type_=Integer()),
)
```

Imports añadidos: `Date, Integer, bindparam` desde `sqlalchemy`.

Archivo:
- `backend/app/services/ventas_service.py`

---

### 4) Corrección del filtro de estado

El filtro original excluía cancelados/rechazados. Se cambió a **incluir solo aprobadas**, alineando el cálculo con la definición de venta real:

```sql
-- Antes
LOWER(COALESCE(v.status, q.status, ''))
    NOT SIMILAR TO '%cancelad%|%cancelled%|%rechazad%'

-- Después
(
    v.id IS NOT NULL
    OR q.approved_on IS NOT NULL
    OR LOWER(COALESCE(v.status, q.status, '')) LIKE '%aprob%'
)
```

Archivo:
- `backend/app/services/ventas_service.py`

---

### 5) Nuevo endpoint

```
GET /api/ventas/product-forecast
```

Query params: `start_date`, `end_date`, `limit` (1–50), `months_window` (1–12).
Requiere autenticación JWT.

Archivos:
- `backend/app/routers/ventas.py`

---

## Frontend (UI + componentes)

### 1) Extensión del componente `BarChart`

Se añadieron dos props opcionales:

- `horizontal?: boolean` — cambia el layout a `"vertical"` en Recharts (barras horizontales), reposiciona `YAxis`/`XAxis` y ajusta el radio de bordes.
- `colorScale?: string[]` — aplica un color diferente por barra usando `<Cell>`, y oculta la leyenda automáticamente.

Archivo:
- `frontend/src/components/charts/BarChart.tsx`

---

### 2) Tipo y servicio

Se añadió el tipo:

```typescript
export type SalesForecastByProduct = {
  product: string
  sku: string | null
  category: string | null
  predicted_units: number
}
```

Y el método `productForecast()` en `ventasService` que llama al nuevo endpoint con los parámetros correspondientes.

Archivos:
- `frontend/src/types/ventas.ts`
- `frontend/src/services/ventasService.ts`

---

### 3) Nueva sección en `VentasDashboard`

Se agregó un `ChartPanel` "Predicción de Ventas por Producto" con dos columnas:

- **Izquierda**: gráfica de barras horizontales con escala de colores (15 colores), valor en `u/mes`.
- **Derecha**: ranking de los top 8 productos con SKU y valor numérico.
- **Badge de acción**: ícono `BrainCircuit` con label "Promedio 3 meses".

El panel se ubica antes de la tabla de cotizaciones recientes.

Archivo:
- `frontend/src/components/dashboards/VentasDashboard.tsx`

---

## Documentación técnica

Se creó `docs/prediccion_ventas_por_producto.md` con:

- Descripción de la métrica y su propósito.
- Fuentes de datos y paso a paso del cálculo.
- Ejemplo numérico completo (producto SV-869).
- Guía de interpretación de la gráfica.
- Limitaciones conocidas (estacionalidad, fechas faltantes, filtros activos).
- Referencia de parámetros de la API.

---

## Contrato API

### `GET /api/ventas/product-forecast`

```json
[
  {
    "product": "AIREADOR HELVEX SV-869",
    "sku": "SV-869",
    "category": "AIREADOR...",
    "predicted_units": 310.0
  }
]
```

---

## Pasos de despliegue / rebuild (Docker)

Solo requiere reconstruir el backend (cambios de Python únicamente):

```bash
docker compose up -d --build backend
```

---

## Archivos modificados

- Backend:
  - `backend/app/services/ventas_service.py`
  - `backend/app/routers/ventas.py`
  - `backend/app/schemas/venta_schema.py`
- Frontend:
  - `frontend/src/components/dashboards/VentasDashboard.tsx`
  - `frontend/src/components/charts/BarChart.tsx`
  - `frontend/src/services/ventasService.ts`
  - `frontend/src/types/ventas.ts`
- Documentación:
  - `docs/prediccion_ventas_por_producto.md`
  - `docs/cambios_2026-04-20_prediccion_ventas_producto.md`

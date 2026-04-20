# Nexus Ops RTB - Métricas y Cálculo de Dashboard de Ventas

Fecha: 2026-04-20

## 1) Objetivo

Documentar, de forma operativa y trazable, cómo se calculan las métricas y gráficas del Dashboard de Ventas (frontend) y desde qué fuentes/tablas se obtienen (backend).

Este documento describe el comportamiento actual del código.

## 2) Vista y Endpoints

Vista:

- `frontend/src/components/dashboards/VentasDashboard.tsx`

Servicio frontend:

- `frontend/src/services/ventasService.ts`

Router backend:

- `backend/app/routers/ventas.py`

Servicio backend (cálculos):

- `backend/app/services/ventas_service.py`

Endpoints consumidos por la vista:

- `GET /api/ventas/summary`
- `GET /api/ventas/top-customers`
- `GET /api/ventas/product-distribution`
- `GET /api/ventas/sales-vs-projection`
- `GET /api/ventas/gross-margin-by-product`
- `GET /api/ventas/quote-status-by-month`
- `GET /api/ventas/recent-quotes`

Todos aceptan filtros de fecha (según endpoint): `start_date`, `end_date` (formato `YYYY-MM-DD`).

## 3) Fuentes de Datos (Modelo)

Tablas principales usadas por el cálculo:

- `ventas` (modelo `Sale`) = “Reporte de Ventas”
- `cotizaciones` (modelo `Quote`) = “Cotizaciones a Clientes”
- `cotizacion_items` (modelo `QuoteItem`) = “Detalles de Cotizaciones”
- `clientes` (modelo `Customer`) = “Directorio/Clientes”

CSV relevantes en `data/csv/` (referencia de origen):

- `Reporte_de_Ventas.csv`
- `Cotizaciones_a_Clientes.csv`
- `Detalle_de_Cotizaciones.csv`
- `Directorio_Clientes_Proveedores.csv`

## 4) Reglas Comunes y Normalización de Estados

### 4.1 Definición “Cotización aprobada”

En backend se considera “aprobada” si:

- `Quote.approved_on IS NOT NULL`, o
- `lower(Quote.status)` contiene `"aprob"`.

Implementación: función `_approved_quote_condition()` en `backend/app/services/ventas_service.py`.

### 4.2 Buckets de estado de cotización (para conteos)

Se agrupan estados en buckets:

- `approved`: `approved_on` no nulo o status contiene `"aprob"`
- `cancelled`: status contiene `"cancel"`
- `rejected`: status contiene `"rechaz"`
- `expired`: status contiene `"expir"`
- `review`: status contiene `"revisi"`, `"pend"` o `"proceso"`
- `quoting`: status contiene `"cotiz"`
- `other`: cualquier otro

Implementación: `_quote_status_bucket_expr()` en `backend/app/services/ventas_service.py`.

## 5) Filtros de Fecha (Importante)

La UI permite seleccionar `startDate` y `endDate`. Cada endpoint aplica el rango sobre columnas distintas:

- `ventas/summary`
  - Ventas: filtra por `Sale.sold_on` (campo de venta)
  - Cotizaciones (conteos): filtra por `Quote.created_on` (campo de creación)
- `ventas/top-customers`: filtra por `Sale.sold_on`
- `ventas/product-distribution`: filtra por `Quote.approved_on` (se excluyen aprobadas sin fecha de aprobación)
- `ventas/gross-margin-by-product`: filtra por `Quote.approved_on` (se excluyen aprobadas sin fecha de aprobación)
- `ventas/quote-status-by-month`: filtra por `Quote.created_on`
- `ventas/recent-quotes`: filtra por `Quote.created_on`
- `ventas/sales-vs-projection`: filtra por `Quote.created_on` (tanto real como proyección)

Nota: el agrupamiento por mes no siempre usa el mismo campo que el filtro; esto está detallado en cada sección.

## 6) Métricas y Gráficas (Detalle por Bloque)

### 6.1 KPI: Ventas Totales del Mes

Endpoint: `GET /api/ventas/summary`

Campo UI: `total_sales`

Fuente y cálculo (backend):

- Suma de `Sale.subtotal` dentro del rango (`Sale.sold_on`).

Pseudo SQL:

```sql
select coalesce(sum(ventas.subtotal), 0) as total_sales
from ventas
where ventas.sold_on >= :start_dt
  and ventas.sold_on <  :end_dt_plus_1;
```

Nota: la etiqueta dice “del mes”, pero el cálculo sigue el rango activo de filtros (si el usuario filtra un rango diferente, la cifra corresponde a ese rango).

### 6.2 KPI: Cotizaciones Pendientes + “Vencen el último día del mes”

Endpoint: `GET /api/ventas/summary`

Campo UI: `pending_quotes`

Fuente y cálculo (backend):

- Conteo de cotizaciones cuyo bucket es `review`, filtradas por `Quote.created_on`.

Pseudo SQL (conceptual):

```sql
select count(*)
from cotizaciones
where created_on >= :start_dt
  and created_on <  :end_dt_plus_1
  and status_normalized in ('review');
```

Badge “Vencen el …” (frontend):

- No se calcula con un campo de vencimiento en DB.
- Se calcula como “último día del mes” del `endDate` seleccionado (o del mes actual si `endDate` no está definido).

Implementación: `pendingQuotesBadge` en `VentasDashboard.tsx`.

### 6.3 KPI: Margen de Ganancia Promedio

Endpoint: `GET /api/ventas/summary`

Campo UI: `average_margin_percent`

Fuente y cálculo (backend):

- Promedio de `Sale.margin_percent` dentro del rango (`Sale.sold_on`).
- `Sale.margin_percent` es un campo calculado en DB como:
  - `(subtotal - purchase_cost) / subtotal` (escala 0–1)
- En respuesta API se multiplica por 100 para devolver porcentaje en escala 0–100.

Pseudo SQL:

```sql
select avg(ventas.margin_percent) * 100.0 as average_margin_percent
from ventas
where sold_on >= :start_dt
  and sold_on <  :end_dt_plus_1;
```

### 6.4 KPI: Tasa de Conversión

Endpoint: `GET /api/ventas/summary`

Campo UI: `conversion_rate`

Fuente y cálculo (backend):

- Se cuentan cotizaciones por bucket (filtradas por `Quote.created_on`).
- `conversion_rate = approved_quotes / total_quotes * 100`
  - `approved_quotes` = bucket `approved`
  - `total_quotes` = suma de todos los buckets (incluye `other`)

Pseudo SQL (conceptual):

```sql
select
  100.0 * approved / nullif(total, 0) as conversion_rate
from (
  select
    sum(case when bucket='approved' then 1 else 0 end) as approved,
    count(*) as total
  from cotizaciones
  where created_on >= :start_dt
    and created_on <  :end_dt_plus_1
) t;
```

### 6.5 Gráfica: Top 10 Clientes por Ventas

Endpoint: `GET /api/ventas/top-customers?limit=10`

Fuente:

- Tabla `ventas` agregada por cliente.
- Se obtiene el nombre desde `clientes` mediante un join robusto:
  - `clientes.id == ventas.customer_id`, o
  - `clientes.external_id == ventas.external_customer_id`, o
  - `cast(clientes.id as text) == ventas.external_customer_id` (cuando el “id” llega como string UUID).

Cálculo:

- `total_revenue = SUM(ventas.subtotal)`
- `sale_count = COUNT(ventas.id)`
- `average_ticket = total_revenue / sale_count`

Pseudo SQL (conceptual):

```sql
select
  coalesce(clientes.name, ventas.external_customer_id, 'Sin cliente') as customer,
  count(ventas.id) as sale_count,
  coalesce(sum(ventas.subtotal), 0) as total_revenue
from ventas
left join clientes on (
  clientes.id = ventas.customer_id
  or clientes.external_id = ventas.external_customer_id
  or cast(clientes.id as text) = ventas.external_customer_id
)
where sold_on >= :start_dt
  and sold_on <  :end_dt_plus_1
group by 1
order by total_revenue desc
limit 10;
```

Frontend:

- Se grafica como barras (valor: `total_revenue`).

### 6.6 Gráfica + Tabla: Distribución de Ventas por Producto

Endpoint: `GET /api/ventas/product-distribution?limit=10`

Fuente:

- `cotizacion_items` + `cotizaciones` + `productos` (si existe el catálogo).

Condiciones:

- Solo items de cotizaciones consideradas aprobadas (`_approved_quote_condition()`).
- El filtro de fechas se aplica sobre `Quote.approved_on` (por eso se excluyen aprobadas sin fecha de aprobación).

Cálculo:

- `revenue(producto) = SUM(QuoteItem.subtotal)`
- `percentage = revenue(producto) / SUM(revenue de todos los productos) * 100`

Pseudo SQL (conceptual):

```sql
select
  coalesce(productos.name, cotizacion_items.sku, 'Sin producto') as product,
  sum(cotizacion_items.subtotal) as revenue
from cotizacion_items
join cotizaciones on cotizaciones.id = cotizacion_items.quote_id
left join productos on productos.id = cotizacion_items.product_id
where cotizaciones.approved_on >= :start_dt
  and cotizaciones.approved_on <  :end_dt_plus_1
  and (cotizaciones.approved_on is not null or lower(cotizaciones.status) like '%aprob%')
group by 1
order by revenue desc
limit 10;
```

Frontend:

- Se muestra en una dona y además en una tabla (Producto / Venta / %).

### 6.7 Gráfica: Ventas Reales vs Proyecciones

Endpoint: `GET /api/ventas/sales-vs-projection`

Objetivo funcional:

- “Real” = montos de cotizaciones aprobadas confirmadas como venta por vínculo `ventas.quote_id`.
- “Proyección” = tendencia simple basada en histórico de cotizaciones aprobadas.

Agrupación por mes:

- Se agrupa con `month_key = to_char(coalesce(Quote.approved_on, Quote.created_on), 'YYYY-MM')`.

Real (línea azul):

- `SUM(Quote.subtotal)` agrupado por `month_key`
- Solo cotizaciones aprobadas
- Solo cotizaciones con venta asociada: join `Sale.quote_id == Quote.id`
- El filtro de rango se aplica sobre `Quote.created_on` (no sobre `approved_on`).

Proyección (línea punteada):

1) Base mensual:
   - `projected_base(month) = SUM(Quote.subtotal)` por mes
   - Solo cotizaciones aprobadas
   - Rango por `Quote.created_on`

2) Transformación a “proyección”:
   - Para el mes `i`, se toma una ventana de hasta 3 meses previos.
   - Se calcula:
     - `average_sales` = promedio de la ventana
     - `avg_growth` = promedio de tasas de crecimiento relativas dentro de la ventana
   - Proyección:
     - `projection = max(average_sales * (1 + avg_growth), 0)`

Implementación:

- `_compute_projected_sales()` en `backend/app/services/ventas_service.py`.

Variación mes a mes (línea %):

- Métrica: variación porcentual de ventas reales contra el mes anterior.
- Fórmula: `((Ventas_mes_actual - Ventas_mes_anterior) / Ventas_mes_anterior) * 100`
- Consideración: si `Ventas_mes_anterior <= 0`, la variación se reporta como `null` (sin punto).

### 6.8 Gráfica: Margen de Ganancia por Producto (monto + %)

Endpoint: `GET /api/ventas/gross-margin-by-product?limit=10`

Fuente:

- `cotizacion_items` + `cotizaciones` + `productos`

Condiciones:

- Solo items de cotizaciones aprobadas (`_approved_quote_condition()`).
- Filtro por `Quote.approved_on`.

Cálculo:

- `revenue = SUM(QuoteItem.subtotal)`
- `cost = SUM(QuoteItem.purchase_subtotal)`
- `gross_margin = revenue - cost`
- `margin_percent = (gross_margin / revenue) * 100` (escala 0–100)

Nota importante:

- El backend devuelve `margin_percent` ya en escala 0–100.
- En la UI el error de “8000%” ocurría cuando se multiplicaba por 100 nuevamente. La UI actual ya no reescala.

Frontend:

- Se grafica el `gross_margin` en monto (barra principal).
- Se muestra el porcentaje como referencia secundaria.

### 6.9 Gráfica: Estado de Cotizaciones por Mes

Endpoint: `GET /api/ventas/quote-status-by-month`

Fuente:

- Tabla `cotizaciones`.

Filtro:

- Rango por `COALESCE(Quote.created_on, Quote.created_at)`.

Agrupación:

- Mes = `to_char(COALESCE(Quote.created_on, Quote.created_at), 'YYYY-MM')`.

Conteos:

- Conteos por estado:
  - `approved_count`, `cancelled_count`, `expired_count`, `review_count`, `quoting_count`, `rejected_count`
- Montos por estado (suma de `COALESCE(total, subtotal, 0)`):
  - `approved_amount`, `cancelled_amount`, `expired_amount`, `review_amount`, `quoting_amount`, `rejected_amount`

Frontend:

- Se grafica como líneas separadas por estado.

### 6.10 Tabla: Cotizaciones Recientes

Endpoint: `GET /api/ventas/recent-quotes?limit=10`

Fuente:

- `cotizaciones` + `clientes` (para nombre del cliente).

Filtro:

- Opcional: `status` (bucket): `approved`, `cancelled`, `review`, `expired`, `quoting`, `rejected`.

Orden:

- Descendente por `Quote.created_at` (más reciente → más antigua).

Campos:

- `id`, `name`, `created_on`, `customer_name`, `status`, `total`, `subtotal`
- `can_convert`: flag calculado por heurística de status (pendiente / revisión / proceso / cotiz)

## 7) Notas de Calidad de Datos

- Si `approved_on` es nulo, endpoints basados en `approved_on` pueden excluir registros aunque el status diga “Aprobada”.
- Si `ventas.customer_id` no está poblado, se intenta resolver el cliente con `ventas.external_customer_id`.
- `Sale.margin_percent` viene en escala 0–1 por ser un computed de DB; en API se presenta en 0–100 cuando aplica.

## 8) Referencia Rápida (Mapa UI → API)

- Ventas Totales del Mes (KPI) → `/api/ventas/summary.total_sales`
- Cotizaciones Pendientes (KPI) → `/api/ventas/summary.pending_quotes` + badge de UI “vencen fin de mes”
- Margen de Ganancia Promedio (KPI) → `/api/ventas/summary.average_margin_percent`
- Tasa de Conversión (KPI) → `/api/ventas/summary.conversion_rate`
- Top 10 Clientes → `/api/ventas/top-customers`
- Distribución por Producto → `/api/ventas/product-distribution`
- Ventas Reales vs Proyecciones → `/api/ventas/sales-vs-projection`
- Margen por Producto → `/api/ventas/gross-margin-by-product`
- Estado por Mes → `/api/ventas/quote-status-by-month`
- Cotizaciones Recientes → `/api/ventas/recent-quotes`

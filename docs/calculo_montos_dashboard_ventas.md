# Cálculo de Montos en el Dashboard de Ventas

> Documento de referencia técnica que explica cómo se calculan los montos y métricas mostrados en `frontend/src/pages/Ventas.tsx` (a través de `VentasDashboard.tsx`).
> 
> Fuente de verdad: `backend/app/services/ventas_service.py`

---

## 1. Aprobadas vs Canceladas vs Expiradas vs En Revisión vs En Cotización vs Rechazada

**Endpoint:** `GET /api/ventas/quote-status-by-month`  
**Función:** `VentasService.quote_status_by_month` (líneas 633–699)

### Agrupación
Se agrupa por mes usando:

```sql
TO_CHAR(COALESCE(Quote.created_on, Quote.created_at), 'YYYY-MM')
```

### Clasificación de estados (bucket)

Cada cotización se clasifica según estas reglas de coincidencia de texto sobre `Quote.status`:

| Estado mostrado | Condición en backend |
|-----------------|----------------------|
| **Aprobadas** | `approved_on IS NOT NULL` **O** `status` contiene `"aprob"` |
| **Canceladas** | `status` contiene `"cancel"` |
| **Rechazada** | `status` contiene `"rechaz"` |
| **Expiradas** | `status` contiene `"expir"` |
| **En revisión** | `status` contiene `"revisi"`, `"pend"` o `"proceso"` |
| **En Cotización** | `status` contiene `"cotiz"` |

### Cálculo del monto por estado

```sql
COALESCE(SUM(Quote.total), Quote.subtotal, 0)
```

- Primero intenta sumar `Quote.total`.
- Si `total` es NULL, usa `Quote.subtotal`.
- Si ambos son NULL, el monto es `0`.

### Filtro de fechas
Aplica sobre `Quote.created_on` / `Quote.created_at` (no sobre la fecha de aprobación ni venta).

---

## 2. Ventas Reales vs Proyecciones

**Endpoint:** `GET /api/ventas/sales-vs-projection`  
**Función:** `VentasService.sales_vs_projection_by_month` (líneas 563–631)

### Ventas Reales (`actual_sales`)

```sql
SELECT 
  TO_CHAR(COALESCE(Quote.approved_on, Quote.created_on), 'YYYY-MM') AS year_month,
  COALESCE(SUM(Quote.subtotal), 0) AS actual_sales
FROM Quote
JOIN Sale ON Sale.quote_id = Quote.id
WHERE <condición_aprobada>
GROUP BY year_month
```

- Se hace **JOIN obligatorio** con la tabla `Sale` (`Sale.quote_id = Quote.id`).
- Solo cotizaciones **aprobadas** (`approved_on IS NOT NULL` o `status` contiene `"aprob"`).
- Suma **`Quote.subtotal`**.
- El mes se determina por `COALESCE(Quote.approved_on, Quote.created_on)`.
- El filtro de fechas aplica sobre `Quote.created_on` / `created_at`.

### Proyecciones (`projected_sales`)

Parte de la misma base de cotizaciones aprobadas agrupadas por mes, pero **sin el JOIN a `Sale`**.

Después de obtener la serie histórica de `projected_base` (suma de `Quote.subtotal` por mes), se aplica la función `_compute_projected_sales` (líneas 194–209):

1. Toma una **ventana móvil de los últimos 3 meses** anteriores al mes actual.
2. Calcula el **promedio de ventas** de esa ventana.
3. Calcula la **tasa de crecimiento promedio** mes a mes dentro de esa ventana.
4. **Proyección = promedio × (1 + crecimiento_promedio)**.

> Para el primer mes de la serie, la proyección es igual al valor real de ese mes.

---

## 3. Diferencia entre "Ventas Reales" (gráfico) y "Ventas Totales del Mes" (KPI)

El dashboard muestra ventas en dos lugares distintos que **usan tablas, campos y fechas diferentes**:

| | **Ventas Reales** (gráfico *Ventas Reales vs Proyecciones*) | **Ventas Totales del Mes** (KPI superior) |
|---|---|---|
| **Endpoint** | `/api/ventas/sales-vs-projection` | `/api/ventas/summary` |
| **Función** | `sales_vs_projection_by_month` | `sales_summary` |
| **Tabla base** | `Quote` + JOIN a `Sale` | `Sale` directamente |
| **Campo sumado** | `Quote.subtotal` | `Sale.subtotal` |
| **Fecha del dato** | `COALESCE(Quote.approved_on, Quote.created_on)` | `Sale.sold_on` |
| **Filtro de fechas** | Sobre `Quote.created_on` / `created_at` | Sobre `Sale.sold_on` |
| **Requisito extra** | La cotización debe estar aprobada **y** tener una venta vinculada (`Sale.quote_id`) | Solo necesita existir en la tabla `Sale` |

### ¿Por qué pueden diferir?

1. **Ventas sin cotización vinculada:** Si existe un registro en `Sale` cuyo `quote_id` es NULL, cuenta para el KPI pero **no** para el gráfico.
2. **Diferencia de fechas:** Una cotización puede haberse creado/aprobado en un mes y registrarse como `sold_on` en otro. El KPI usa `sold_on`; el gráfico usa `approved_on`/`created_on`.
3. **Tabla origen:** El KPI lee directamente la tabla de ventas (`Sale.subtotal`). El gráfico lee el subtotal de la cotización (`Quote.subtotal`) a través del JOIN.

---

## Resumen rápido de fuentes de datos

| Métrica | Tabla principal | Campo de suma | Fecha de agrupación/filtro |
|---------|-----------------|---------------|----------------------------|
| Aprobadas / Canceladas / etc. | `Quote` | `COALESCE(total, subtotal, 0)` | `created_on` / `created_at` |
| Ventas Reales (vs Proyección) | `Quote` JOIN `Sale` | `Quote.subtotal` | `approved_on` / `created_on` |
| Proyección | `Quote` (aprobadas) | `Quote.subtotal` | `approved_on` / `created_on` (promedio móvil) |
| Ventas Totales del Mes (KPI) | `Sale` | `Sale.subtotal` | `sold_on` |

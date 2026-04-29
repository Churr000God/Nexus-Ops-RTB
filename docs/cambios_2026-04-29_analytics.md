# Módulo 15 — Reportes y Analytics (2026-04-29)

## Contexto

Implementación del módulo de analytics y reportes ejecutivos. El módulo expone
21 vistas SQL de solo lectura que agregan datos de todos los módulos operativos
(ventas, compras, inventario, CFDI, logística, financiero) para dashboards de
dirección y análisis.

---

## Base de Datos

### Migración aplicada

| Revisión | Nombre | Contenido |
|---|---|---|
| `0024` | `0024_views_reportes` | 21 vistas SQL analíticas aplicadas en Supabase vía MCP |

### Vistas creadas (21)

#### Comercial
| Vista | Descripción |
|---|---|
| `v_sales_by_period` | Ventas, costo y margen por año/mes/trimestre |
| `v_top_customers` | Ranking de clientes por revenue, con margen y días desde último pedido |
| `v_quote_conversion` | Tasa de conversión de cotizaciones por mes (aprobadas / total) |
| `v_sales_rep_performance` | Cotizaciones, conversión y revenue por vendedor |

#### Margen
| Vista | Descripción |
|---|---|
| `v_product_margin` | Margen real vs target por SKU vendido |
| `v_customer_profitability` | Rentabilidad por cliente: margen, cobranza, días de pago |
| `v_category_margin` | Margen real vs target por categoría de productos |

#### Compras
| Vista | Descripción |
|---|---|
| `v_top_suppliers` | Ranking de proveedores por monto comprado |
| `v_supplier_performance` | Lead time real vs estimado, % cumplimiento, NCs por proveedor |
| `v_supplier_invoices_aging` | Facturas pendientes clasificadas por antigüedad (CURRENT / OVERDUE_0_30 / etc.) |

#### Financiero
| Vista | Descripción |
|---|---|
| `v_accounts_receivable` | AR aging: saldo por cobrar segmentado en buckets de 30 días |
| `v_accounts_payable` | AP aging: saldo por pagar por proveedor |
| `v_cash_flow_projection` | Proyección de flujo de caja (próximos 90 días) |
| `v_expenses_by_category` | Gastos operativos por categoría y mes |
| `v_cfdi_emitted` | Catálogo de CFDIs emitidos con saldos y relaciones |
| `v_cfdi_summary_by_period` | Resumen de facturación por período, tipo y estatus |
| `v_payments_unapplied` | Pagos recibidos con saldo sin aplicar |

#### Operación
| Vista | Descripción |
|---|---|
| `v_warehouse_kpis` | KPIs de almacén: stock, movimientos del mes, pedidos activos (single-row) |
| `v_nc_by_supplier` | No conformidades agrupadas por proveedor |
| `v_route_efficiency` | Eficiencia de rutas de entrega: paradas, duración, % completado |

#### Ejecutivo
| Vista | Descripción |
|---|---|
| `v_executive_dashboard` | 14 KPIs unificados para dirección general (single-row) |

### Adaptaciones al schema real

El diseño original usaba nombres de columnas y tablas distintos a los de la BD real.
Adaptaciones aplicadas en las vistas:

| Diseño original | BD real |
|---|---|
| `products` | `productos` |
| `categories` | `categorias` |
| `operating_expenses` | `gastos_operativos` |
| `non_conformities` | `no_conformes` |
| `users.user_id` | `users.id` (UUID) |
| `inventory_movements.occurred_at` | `inventory_movements.moved_on` |
| `supplier_invoices.payment_due_date` | Calculado: `invoice_date + COALESCE(payment_terms_days, 30)` |
| `cfdi.receiver_legal_name` | `cfdi.receiver_name` |
| `stock_status = 'OUT_OF_STOCK'` | `stock_status = 'OUT'` |
| Columnas de costo faltantes | `NULL::NUMERIC` (activarán al agregar las columnas) |

---

## Backend

### Archivos nuevos

**`backend/app/schemas/analytics_schema.py`**
- 21 modelos Pydantic v2 con `ConfigDict(from_attributes=True)`
- Clase base `_AnalyticsBase` para config compartida
- `ExecutiveDashboard` y `WarehouseKpis` son objetos single-row; el resto son listas
- Campos de costo/margen tipados como `Decimal | None` para columnas aún inexistentes

**`backend/app/services/analytics_service.py`**
- Helpers `_fetch_all` y `_fetch_one` con `text()` + `result.mappings()`
- 17 funciones async (una por endpoint)
- Filtros opcionales (`year`, `month`, `limit`) usando parámetros `:named` (sin f-strings)

**`backend/app/routers/analytics.py`**
- `APIRouter(prefix="/api/analytics", tags=["analytics"])`
- 20 endpoints GET de solo lectura
- Todos requieren permiso `report.view` via `Depends(require_permission(...))`

### Archivo modificado

**`backend/app/main.py`**
- `from app.routers.analytics import router as analytics_router`
- `app.include_router(analytics_router)`

---

## Frontend

### Archivos nuevos

**`frontend/src/types/analytics.ts`**
- 21 interfaces TypeScript con tipos `number | null` para campos de costo/margen
- `AgingBucket` union type: `"PAID" | "CURRENT" | "OVERDUE_0_30" | "OVERDUE_30_60" | "OVERDUE_60_PLUS"`

**`frontend/src/services/analyticsService.ts`**
- 17 funciones con `requestJson(url, { signal })`
- `URLSearchParams` para parámetros opcionales (`year`, `month`, `limit`)

### Archivos reemplazados (eran PlaceholderPage)

| Página | Ruta | Tabs / Secciones |
|---|---|---|
| `ComercialPage.tsx` | `/reportes/comercial` | Ventas por Período · Top Clientes · Conversión · Por Vendedor |
| `MargenPage.tsx` | `/reportes/margen` | Por Producto · Por Categoría · Rentabilidad Clientes |
| `OperacionPage.tsx` | `/reportes/operacion` | KPI cards almacén (8) + NCs · Rutas |
| `ComprasReportesPage.tsx` | `/reportes/compras` | Top Proveedores · Desempeño · Aging Facturas |
| `FinancieroPage.tsx` | `/reportes/financiero` | Cuentas x Cobrar · Cuentas x Pagar · Flujo de Caja · Gastos · CFDI por Período · Pagos Sin Aplicar |

### Sin cambios necesarios

- `routes.tsx` — Las 5 rutas ya existían
- `Sidebar.tsx` — Los 5 links ya existían

---

## Patrones usados

```tsx
// Sub-tab con datos propios
function MiTab({ year }: { year: number | undefined }) {
  const fetcher = useCallback(
    (signal: AbortSignal) => miServicio({ year }, signal),
    [year],
  )
  const { data, status } = useApi(fetcher)

  return (
    <DataTable
      columns={COLS}
      rows={data ?? []}
      rowKey={(r) => String(r.id)}
      emptyLabel={status === "loading" ? "Cargando…" : "Sin datos"}
    />
  )
}
```

Tabs con botones propios (mismo patrón que `CfdiPage.tsx`):
```tsx
<div className="flex gap-1 border-b border-white/10">
  {TABS.map(({ id, label }) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={cn(
        "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
        tab === id
          ? "border-[hsl(var(--primary))] text-white"
          : "border-transparent text-white/50 hover:text-white",
      )}
    >
      {label}
    </button>
  ))}
</div>
```

---

## Permisos

El acceso a todos los endpoints del módulo requiere el permiso `report.view`.
Este permiso debe estar asignado al rol del usuario en la tabla `permissions`.

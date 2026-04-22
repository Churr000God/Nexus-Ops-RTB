# ERR-0012: TS2322 MissingDemandByProduct[] no asignable a ProductSuggestion[]

**Fecha:** 2026-04-22
**Area:** frontend
**Severidad:** bajo
**Estado:** resuelto

## Descripcion

`docker compose build --no-cache frontend` falla con:

```
src/components/dashboards/VentasDashboard.tsx(1524,11): error TS2322:
Type 'MissingDemandByProduct[]' is not assignable to type 'ProductSuggestion[]'.
  Type 'MissingDemandByProduct' is missing the following properties from type 'ProductSuggestion': qty, revenue
```

## Contexto

Al agregar el componente `ProductSearchInput` para la sección de demanda faltante, se pasó `missingDemand.data` directamente al prop `suggestions` del componente. `ProductSearchInput` espera el tipo `ProductSuggestion` (`product`, `sku`, `qty`, `revenue`) pero `MissingDemandByProduct` usa nombres de campo distintos para las métricas numéricas (`demanda_faltante`, `valor_venta_pendiente`).

## Causa Raiz

Incompatibilidad de tipos entre el dominio de negocio (`MissingDemandByProduct`) y el contrato del componente reutilizable (`ProductSuggestion`). El componente `ProductSearchInput` fue diseñado genérico con campos `qty`/`revenue`, pero la entidad de demanda faltante usa nomenclatura propia del dominio.

## Solucion

Mapeo en el call site dentro de `VentasDashboard.tsx`:

```tsx
// Antes:
suggestions={missingDemand.data ?? []}

// Después:
suggestions={(missingDemand.data ?? []).map((d) => ({
  product: d.product,
  sku: d.sku,
  qty: d.demanda_faltante,
  revenue: d.valor_venta_pendiente,
}))}
```

## Prevencion

Cuando se reutiliza `ProductSearchInput` con una nueva fuente de datos, siempre mapear explícitamente al tipo `ProductSuggestion` en el call site. No pasar datos de dominio directamente al prop `suggestions`.

## Archivos Afectados

- `frontend/src/components/dashboards/VentasDashboard.tsx` — mapeo en prop `suggestions` del tercer `ProductSearchInput` (sección demanda faltante)

## Referencias

- Commit: `06d4dc7` — feat(ventas): corrige calculos de graficas y agrega busqueda por producto

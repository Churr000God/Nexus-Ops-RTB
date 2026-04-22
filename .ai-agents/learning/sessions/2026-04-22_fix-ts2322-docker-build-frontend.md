# Sesion: Fix TS2322 docker build frontend — MissingDemandByProduct vs ProductSuggestion

**Fecha:** 2026-04-22
**Agente:** Claude Sonnet 4.6
**Area:** frontend
**Sprint:** 2
**Duracion aprox:** 10 min

## Objetivo

Resolver el fallo de `docker compose build --no-cache frontend backend` causado por un type error de TypeScript en `VentasDashboard.tsx`.

## Contexto Previo

El commit `06d4dc7` agregó el componente `ProductSearchInput` para tres secciones del dashboard (distribución de productos, margen bruto, demanda faltante). Las dos primeras instancias funcionaban correctamente. La tercera, para la sección de demanda faltante, pasaba `missingDemand.data` directamente sin mapear al tipo que espera el componente.

## Trabajo Realizado

- Diagnosticó el error de TypeScript: `MissingDemandByProduct` carece de `qty` y `revenue`
- Identificó los campos equivalentes: `demanda_faltante` → `qty`, `valor_venta_pendiente` → `revenue`
- Aplicó mapeo en el call site en `VentasDashboard.tsx` línea ~1542

## Decisiones Tomadas

- Mapeo en el call site en lugar de modificar el tipo `ProductSuggestion` o `MissingDemandByProduct`: mantiene los tipos de dominio intactos y el componente reutilizable genérico.

## Errores Encontrados

- ERR-0012: TS2322 MissingDemandByProduct[] no asignable a ProductSuggestion[]

## Lecciones Aprendidas

- Al reutilizar `ProductSearchInput` con una nueva entidad, siempre mapear explícitamente `qty`/`revenue` desde los campos de dominio correspondientes.
- Los type errors de build en Docker se diagnostican directamente del log de la capa `RUN npm run build`, sin necesidad de entrar al contenedor.

## Archivos Modificados

- `frontend/src/components/dashboards/VentasDashboard.tsx` — mapeo en prop `suggestions` de `ProductSearchInput` (sección demanda faltante)
- `.ai-agents/errors/resolutions/ERR-0012_ts2322-missingdemandbyproduct-no-asignable-productsugestion.md` — registro del error

## Siguiente Paso

Verificar que `docker compose build --no-cache frontend backend` termina sin errores tras el fix.

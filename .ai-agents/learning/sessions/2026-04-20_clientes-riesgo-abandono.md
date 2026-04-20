# Sesion: Clientes en Riesgo de Abandono

**Fecha:** 2026-04-20
**Agente:** Kimi
**Area:** backend + frontend
**Sprint:** 2
**Duracion aprox:** 60 min

## Objetivo
Implementar la funcionalidad de deteccion de clientes en riesgo de abandono comparando compras recientes (ultimos 90 dias) contra el periodo anterior (90 dias previos).

## Contexto Previo
- Se habia implementado previamente "Proyeccion de ventas por periodo" pero se descarto porque se solapaba con el endpoint existente `/api/ventas/sales-vs-projection`.
- El dashboard de Ventas ya contenia multiples graficos y tablas.

## Trabajo Realizado
- **Schema:** Agrego `AtRiskCustomerResponse` con campos de compras, ultima compra y nivel de riesgo.
- **Service:** Implemento `VentasService.at_risk_customers()` con CTE SQL exacto del requerimiento, usando `CASE` para clasificar riesgo y `ORDER BY` con `CASE` para priorizar criticos.
- **Router:** Nuevo endpoint `GET /api/ventas/at-risk-customers`.
- **Frontend types:** Agrego `AtRiskCustomer`.
- **Frontend service:** Agrego `ventasService.atRiskCustomers()`.
- **Dashboard:** Integra panel con:
  - `BarChart` horizontal comparando compras de ambos periodos (top 15 clientes).
  - Tabla semaforo con badges de color segun riesgo (Critico=rojo, Alto=naranja, Medio=amarillo, Bajo=verde).

## Decisiones Tomadas
- Se reutilizo el patron de SQL crudo (`text()`) del backend por ser una query compleja con CTE y CASE que el ORM no genera limpiamente.
- Se limito el grafico a 15 clientes para evitar saturacion visual, mostrando todos en la tabla semaforo.
- Se descarto la implementacion previa de "Proyeccion de ventas por periodo" tras confirmacion del usuario para evitar duplicidad.

## Errores Encontrados
- Durante el desarrollo se inserto accidentalmente un `atRiskChart` duplicado en el dashboard, lo cual rompio el build de Docker. Se resolvio eliminando la declaracion duplicada.

## Lecciones Aprendidas
- Al hacer multiples reemplazos en un archivo grande con `StrReplaceFile`, es facil crear duplicados si un edit falla parcialmente. Conviene verificar con `grep` despues de ediciones complejas.
- El build de Docker (`docker compose build`) es la verificacion definitiva cuando los tests locales no corren por falta de variables de entorno.

## Archivos Modificados
- `backend/app/schemas/venta_schema.py` — nuevo schema `AtRiskCustomerResponse`
- `backend/app/services/ventas_service.py` — nuevo metodo `at_risk_customers()`
- `backend/app/routers/ventas.py` — nuevo endpoint `/at-risk-customers`
- `frontend/src/types/ventas.ts` — nuevo tipo `AtRiskCustomer`
- `frontend/src/services/ventasService.ts` — nuevo metodo `atRiskCustomers()`
- `frontend/src/components/dashboards/VentasDashboard.tsx` — panel de riesgo de abandono

## Siguiente Paso
- Conectar a datos reales cuando el stack este levantado para validar visualmente el semaforo.

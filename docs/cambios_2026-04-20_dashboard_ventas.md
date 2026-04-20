# Cambios implementados — Dashboard de Ventas (2026-04-20)

## Contexto

Se realizaron ajustes en backend y frontend para corregir la carga de cotizaciones, alinear los estados de cotización con el dominio real, mejorar el cálculo del Top 10 de clientes por ventas, y enriquecer las gráficas con información adicional (puntos por mes, variación mes a mes y montos por estado).

Este documento resume los cambios funcionales, el contrato API actualizado y los pasos de despliegue.

---

## Resumen ejecutivo

- Cotizaciones recientes: orden por `created_at` (más reciente → más antigua), filtro por estado aplicado en backend y eliminación de columna “Acciones”.
- Estados unificados: Aprobada, Cancelada, En revisión, Expirada, En Cotización, Rechazada.
- Gráfica de estados por mes: ahora incluye conteos y montos por estado.
- Ventas reales vs proyección: se agrega variación % mes a mes (MoM) como serie adicional.
- Top 10 clientes: se recalcula siguiendo la relación `clientes -> cotizaciones -> ventas`.
- CORS en desarrollo: se habilitan orígenes locales por defecto cuando `ALLOWED_ORIGINS` está vacío.
- Utilidades de ingesta: `sync_csv_data.py` robustecido para ejecución en contenedor.

---

## Backend (API + lógica)

### 1) Top 10 clientes por ventas

- Cambio de estrategia: el ranking se calcula desde `clientes`, enlazando `cotizaciones` por `customer_id` y `ventas` por `quote_id`.
- Beneficios:
  - El nombre sale consistentemente de `clientes.name`.
  - El total proviene de ventas realmente vinculadas a cotizaciones.

Archivos:
- `backend/app/services/ventas_service.py`

---

### 2) Cotizaciones recientes: query segura + orden por created_at

- Se reemplazó el `select(Quote)` por un `select()` de columnas específicas para evitar errores cuando la tabla real no tiene todas las columnas del modelo.
- Query base equivalente:
  - `cotizaciones` LEFT JOIN `clientes`
  - `ORDER BY cotizaciones.created_at DESC`
  - `LIMIT :limit`
- Se añadió `COALESCE(clientes.name, 'Sin cliente')`.

Archivos:
- `backend/app/services/ventas_service.py`

---

### 3) Cotizaciones recientes: filtro por estado (bucket)

- Nuevo query param: `status` para `/api/ventas/recent-quotes`.
- El filtro se aplica como bucket para evitar inconsistencias entre conteos y tabla:
  - `approved`, `cancelled`, `review`, `expired`, `quoting`, `rejected`

Archivos:
- `backend/app/routers/ventas.py`
- `backend/app/services/ventas_service.py`

Contrato:
- `GET /api/ventas/recent-quotes?limit=10&status=review`

---

### 4) Gráfica: estado de cotizaciones por mes (conteos + montos)

- Se expandieron los estados a 6 buckets:
  - `approved`, `cancelled`, `review`, `expired`, `quoting`, `rejected`
- Agrupación mensual:
  - `to_char(COALESCE(created_on, created_at), 'YYYY-MM')`
- Se añadieron montos por estado:
  - `SUM(COALESCE(total, subtotal, 0))` por bucket y mes

Archivos:
- `backend/app/services/ventas_service.py`
- `backend/app/schemas/venta_schema.py`

Respuesta (por mes):
- Conteos: `*_count`
- Montos: `*_amount`

---

### 5) CORS en desarrollo

- Si `ALLOWED_ORIGINS` está vacío y `ENV=development`, se permiten orígenes locales típicos:
  - `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost`, etc.

Archivo:
- `backend/app/config.py`

---

### 6) Ingesta CSV: soporte de ejecución en contenedor + mapeo de IDs

- `backend/scripts/sync_csv_data.py`:
  - Se ajustó el orden de configuración de `sys.path` para garantizar importación de `app.*`.
  - Se robusteció `CSV_DIR` para escenarios locales y contenedor.
- `backend/alembic/versions/20260419_0002_import_csv_data.py`:
  - Import de directorio: `entity_id` proviene de `id_clientes_proveedores`.

Archivos:
- `backend/scripts/sync_csv_data.py`
- `backend/alembic/versions/20260419_0002_import_csv_data.py`

---

### 7) Nuevo endpoint: forecast por producto

- Endpoint nuevo:
  - `GET /api/ventas/product-forecast?start_date=...&end_date=...&months_window=...&limit=...`
- Respuesta:
  - `SalesForecastByProductResponse`

Archivos:
- `backend/app/routers/ventas.py`
- `backend/app/schemas/venta_schema.py`
- `backend/app/services/ventas_service.py`

---

## Frontend (UI + componentes)

### 1) Tabla “Cotizaciones recientes”

- Se eliminó la columna “Acciones”.
- El filtro por estado ahora también filtra el backend (`status=`), evitando discrepancias (conteo vs 0 filas).
- El orden mostrado corresponde a `created_at` descendente (API).

Archivo:
- `frontend/src/components/dashboards/VentasDashboard.tsx`

---

### 2) Gráfica “Ventas Reales vs Proyecciones”

- Se agregó una tercera serie:
  - “Variación % mes a mes”
  - Fórmula: `((ventas_actual - ventas_anterior) / ventas_anterior) * 100`
  - Si `ventas_anterior <= 0`, se muestra como `null` (sin punto).
- Se añadió soporte de eje derecho (%) en el wrapper de líneas.

Archivos:
- `frontend/src/components/dashboards/VentasDashboard.tsx`
- `frontend/src/components/charts/LineChart.tsx`

---

### 3) Gráfica de estados por mes: tooltip con conteo + monto

- El tooltip del gráfico muestra por cada estado:
  - Conteo
  - Monto (MXN)
- Se extendió el tipo `QuoteStatusByMonth` para incluir montos.

Archivos:
- `frontend/src/components/dashboards/VentasDashboard.tsx`
- `frontend/src/types/ventas.ts`

---

### 4) Design system / consistencia visual

- Se añadieron/ajustaron componentes base para consistencia:
  - `ChartPanel`, `StatusBadge`, mejoras en `DataTable`, `KpiCard`, layout.
- Se reforzaron micro-interacciones y coherencia de espaciados/colores.

Archivos (principales):
- `frontend/src/components/common/ChartPanel.tsx`
- `frontend/src/components/common/StatusBadge.tsx`
- `frontend/src/components/common/DataTable.tsx`
- `frontend/src/components/common/KpiCard.tsx`
- `frontend/src/components/layout/*`
- `frontend/src/styles/globals.css`

---

## Contratos API actualizados

### `GET /api/ventas/recent-quotes`

Query params:
- `limit` (int, default 10)
- `status` (opcional): `approved|cancelled|review|expired|quoting|rejected`

### `GET /api/ventas/quote-status-by-month`

Campos nuevos por mes:
- `quoting_count`, `rejected_count`
- `approved_amount`, `cancelled_amount`, `expired_amount`, `review_amount`, `quoting_amount`, `rejected_amount`

---

## Pasos de despliegue / rebuild (Docker)

Los cambios incluyen modificaciones de contrato API y UI; reconstruir ambos servicios:

```bash
docker compose build --no-cache backend frontend
docker compose up -d --force-recreate backend frontend proxy
```

---

## Archivos modificados (lista de alto nivel)

- Backend:
  - `backend/app/services/ventas_service.py`
  - `backend/app/routers/ventas.py`
  - `backend/app/schemas/venta_schema.py`
  - `backend/app/config.py`
  - `backend/scripts/sync_csv_data.py`
  - `backend/alembic/versions/20260419_0002_import_csv_data.py`
  - `backend/tests/test_ventas_endpoints.py`
- Frontend:
  - `frontend/src/components/dashboards/VentasDashboard.tsx`
  - `frontend/src/components/charts/LineChart.tsx`
  - `frontend/src/services/ventasService.ts`
  - `frontend/src/types/ventas.ts`
  - Ajustes adicionales de UI/layout en componentes comunes y estilos globales.


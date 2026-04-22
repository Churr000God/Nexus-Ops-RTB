# Sesion: Infraestructura de Sync n8n y Validacion de Graficas de Ventas

**Fecha:** 2026-04-21
**Agente:** Claude Sonnet 4.6
**Area:** backend + frontend + n8n + db
**Sprint:** 2
**Duracion aprox:** 3 h

## Objetivo
1. Implementar el pipeline de sincronizacion automatica de datos: n8n (Notion CSV) → webhook → backend → PostgreSQL.
2. Validar los datos de cada grafica del dashboard de Ventas contra consultas directas a la base de datos, corrigiendo errores de calculo.

---

## Contexto Previo
- El dashboard de Ventas contenia multiples graficas con datos potencialmente incorrectos porque usaban la tabla `ventas` (sin relacion a cotizaciones) o logica de JOIN incorrecta.
- No existia mecanismo de sincronizacion automatica; los CSV se importaban manualmente.
- El header del dashboard no tenia boton de actualizacion ni indicador de estado de sync.

---

## Trabajo Realizado

### Infraestructura de Sync (n8n → backend)

- **`backend/app/routers/sync.py`** (nuevo): Endpoints `/api/sync/upload-csv` y `/api/sync/finalize`.
  - Acepta `{ filename, content (base64), dataset }` en JSON, no multipart/form-data.
  - Autenticacion via header `x-sync-key` validado contra `SYNC_KEY` en env.
- **`backend/app/services/sync_service.py`** (nuevo): Orquestador del pipeline de sync.
  - Recibe CSVs en memoria, los escribe a disco temporalmente, llama `sync_csv_data.py` en subprocess.
  - Fix PYTHONPATH: agrega `/app` al env del subprocess para que `import app.*` funcione.
  - Agrupa los 19 datasets esperados; al recibir `finalize` verifica que todos llegaron y lanza importacion.
- **`backend/app/config.py`**: Se agrego `SYNC_KEY: str` a Settings.
- **`.env.example`**: Se agrego `SYNC_KEY=rtb-sync-2026`.
- **`backend/app/main.py`**: Se registro `sync_router`.
- **`scripts/test_sync_webhook.py`** (nuevo): Script de pruebas que envia 19 CSVs vacios y llama finalize.

### Auto-refresh del dashboard tras sync

- **`frontend/src/stores/syncStore.ts`** (nuevo): Store Zustand con `syncVersion: number` y `bumpSyncVersion()`.
- **`frontend/src/hooks/useSyncStatus.ts`** (nuevo): Hook que polling del estado de sync y llama `bumpSyncVersion()` al detectar transicion `syncing/importing → done`.
- **`frontend/src/services/syncService.ts`** (nuevo): Llamadas a los endpoints de sync status.
- **`frontend/src/components/layout/Header.tsx`**: Se integro `useSyncStatus` y se agrego indicador visual de estado + boton de actualizacion manual.
- **`frontend/src/components/layout/AppShell.tsx`**: Se monto `useSyncStatus` a nivel de layout para que el polling sea global.
- **`frontend/src/components/dashboards/VentasDashboard.tsx`**: Se agrego `syncVersion` como dep en los 17 `useCallback`/`useApi` calls.
- **`frontend/src/components/dashboards/DashboardGeneral.tsx`**: Idem para los 4 calls.

### Validacion y correccion de graficas de Ventas

**Grafica: Productos Vendidos por Tipo de Cliente**
- Antes: usaba un solo campo `cantidad_productos` y filtraba a `category IN ('Local', 'Foraneo')` excluyendo "Sin categoria".
- Despues: separado en `cantidad_solicitada` (qty_requested) y `cantidad_empacada` (qty_packed), sin filtro de categoria, usa `COALESCE(NULLIF(TRIM(cl.category), ''), 'Sin categoría')`.
- Schema: `ProductsByCustomerTypeResponse` — reemplazado `cantidad_productos` por `cantidad_solicitada` + `cantidad_empacada`.
- Frontend: chart ahora muestra dos barras por tipo de cliente.

**Grafica: Top 10 Clientes por Ventas**
- Antes: usaba ORM join sobre tabla `ventas` (INNER JOIN, excluia clientes sin relacion directa).
- Despues: reescrito en SQL puro sobre `cotizaciones` Aprobadas LEFT JOIN `clientes`, con busqueda ILIKE por nombre, devuelve campo `category`.
- Frontend: `CustomerSearchInput` extraido como componente independiente para evitar re-renders completos del dashboard al escribir.
- Schema/Type: `SalesByCustomerResponse` ahora incluye `category: str | None`.

**Grafica: Promedio de Ventas por Tipo de Cliente**
- Antes: calculo ORM agrupaba incorrectamente; `Sin categoria` tenia 1 cliente con avg $495,463 (distorsionado por 43 cotizaciones sin `customer_id`).
- Despues: reescrito con CTE SQL. Filtra `customer_id IS NOT NULL` para que el denominador sea correcto. Resultado: Local $34,841/cliente, Foraneo $12,543/cliente, Sin categoria $3,696/cliente.

**Componente: CustomerSearchInput**
- Extraido de `VentasDashboard` a `frontend/src/components/common/CustomerSearchInput.tsx`.
- Maneja su propio `inputValue`, `showDropdown`, debounce 300ms, y cierre click-outside.
- Patron clave: `onMouseDown={(e) => e.preventDefault()}` en sugerencias para evitar que `blur` se dispare antes del `click`.

---

## Decisiones Tomadas

- **JSON+base64 en lugar de multipart**: n8n Code node genera base64 de forma confiable con `helpers.getBinaryDataBuffer()`; multipart/form-data requeria configuracion extra y era fragil.
- **`syncVersion` como dep global**: Alternativa simple a un event bus; incrementar un entero en Zustand invalida todos los caches de `useApi` sin requerir refactor de cada hook.
- **Extraccion de `CustomerSearchInput`**: React re-renderiza todo el arbol cuando el estado cambia en el padre; mover el estado de input al componente hijo reduce el scope del re-render a ~10 nodos en lugar de todo el dashboard (17 graficas).
- **`NULLS LAST` en ORDER BY qty_packed**: PostgreSQL pone NULLs primero en DESC por defecto; sin `NULLS LAST` los productos sin empacar aparecian al inicio.
- **`COALESCE(NULLIF(TRIM(cl.category), ''), 'Sin categoría')`**: Solo `COALESCE` no atrapa strings vacios `''`; hay registros con `category = ''` en la BD que se deben tratar igual que NULL.

---

## Errores Encontrados

- `ERR-0008`: `ModuleNotFoundError: No module named 'app'` en subprocess de sync → ver resolucion.
- `ERR-0009`: n8n enviaba `"content": "filesystem-v2"` en lugar de base64 → ver resolucion.
- `ERR-0010`: Dropdown de busqueda de clientes se cerraba antes de registrar el click → ver resolucion.
- `ERR-0011`: `ORDER BY qty_packed DESC` mostraba NULLs primero en PostgreSQL → ver resolucion.

---

## Lecciones Aprendidas

- En subprocesos Python lanzados desde FastAPI en Docker, el `PYTHONPATH` del proceso padre no se hereda automaticamente; hay que construirlo explicitamente con `os.environ.copy()`.
- El boton de `blur` en inputs HTML se dispara antes de `click` en el elemento siguiente; `onMouseDown + preventDefault` es el patron estandar para mantener el foco mientras el usuario selecciona de una lista.
- Los dashboards con muchas graficas son muy sensibles a re-renders de estado de input en el componente padre; siempre extraer inputs con debounce a sus propios componentes.
- `COALESCE` sobre campos de BD puede ser insuficiente si los datos tienen strings vacios (`''`) en lugar de `NULL`; usar `COALESCE(NULLIF(TRIM(campo), ''), 'default')` como patron defensivo.

---

## Archivos Modificados

- `backend/app/routers/sync.py` — nuevo router de sync CSV
- `backend/app/services/sync_service.py` — nuevo servicio orquestador de sync
- `backend/app/config.py` — agrega SYNC_KEY a Settings
- `backend/app/main.py` — registra sync_router
- `backend/app/routers/ventas.py` — agrega customer_search param a top-customers
- `backend/app/schemas/venta_schema.py` — actualiza ProductsByCustomerTypeResponse y SalesByCustomerResponse
- `backend/app/services/ventas_service.py` — reescribe top_customers, products_by_customer_type, avg_sales_by_customer_type con SQL puro y correcciones de logica
- `frontend/src/stores/syncStore.ts` — nuevo store Zustand para syncVersion
- `frontend/src/hooks/useSyncStatus.ts` — nuevo hook de polling de estado sync
- `frontend/src/services/syncService.ts` — nuevo servicio para endpoints sync
- `frontend/src/components/layout/Header.tsx` — indicador de sync + boton refresh
- `frontend/src/components/layout/AppShell.tsx` — monta useSyncStatus global
- `frontend/src/components/common/CustomerSearchInput.tsx` — nuevo componente de busqueda con debounce
- `frontend/src/components/dashboards/VentasDashboard.tsx` — syncVersion deps, CustomerSearchInput, graficas corregidas
- `frontend/src/components/dashboards/DashboardGeneral.tsx` — syncVersion deps
- `frontend/src/types/ventas.ts` — actualiza ProductsByCustomerType y SalesByCustomer
- `frontend/src/services/ventasService.ts` — agrega customerSearch a topCustomers
- `scripts/test_sync_webhook.py` — script de pruebas de sync
- `.env.example` — agrega SYNC_KEY

---

## Siguiente Paso

- Continuar validacion de graficas restantes en VentasDashboard: "Distribucion de Ventas por Producto" (verificar si debe ordenar por qty_packed o revenue), forecast, margin, at-risk customers.
- Confirmar con el usuario si la grafica "Distribucion de Ventas por Producto" debe ordenarse por cantidad empacada o por ingreso.

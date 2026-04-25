# Bitácora de Cambios (sesiones)

## 2026-04-24 — Tiempos de aprobación y diferencia Venta vs PO en Dashboard de Ventas

### Backend (FastAPI)

- `venta_schema.py`: nuevo schema `ApprovalTimeTrendResponse` (year_month, avg_days, upper_days,
  lower_days, count, projected_days); campos `diff_vs_po_monto` y `diff_vs_po_pct` añadidos a
  `SalesSummaryResponse`.
- `ventas_service.py`:
  - Nuevo método `approval_time_trend`: calcula `approved_on − created_on` de cotizaciones
    aprobadas agrupado por mes; incluye banda de variación ±σ (`stddev_pop`) y proyección lineal
    simple a 3 meses (funciona con ≥1 mes de datos, pendiente plana con 1 solo punto).
  - `sales_summary`: añade query de diff_vs_po via JOIN `ventas → cotizaciones` usando
    `cotizacion.subtotal` como PO; calcula diferencia en monto y porcentaje.
- `ventas.py` (router): nuevo endpoint `GET /api/ventas/approval-time-trend`.

### Frontend (React)

- `ventas.ts`: nuevo tipo `ApprovalTimeTrend`; campos `diff_vs_po_monto` y `diff_vs_po_pct` en
  `SalesSummary`.
- `ventasService.ts`: nuevo método `approvalTimeTrend`.
- `VentasDashboard.tsx`:
  - Grid de KPIs cambiado de 4 → 6 columnas; añadidas 2 tarjetas nuevas:
    - **Tiempo Promedio de Aprobación**: promedio de días del período seleccionado.
    - **Diferencia Venta vs PO**: monto y % de desviación PO vs venta real.
  - Nuevo `ChartPanel` "Tiempos de Aprobación de Cotizaciones": `LineChart` con 4 líneas
    (promedio sólida, +σ punteada, −σ punteada, proyección púrpura punteada); tooltip
    personalizado en días.

### Base de datos

- `UPDATE ventas SET subtotal_in_po = cotizaciones.subtotal WHERE quote_id = cotizaciones.id`:
  pobló 466 filas con el subtotal de la cotización relacionada (dato histórico).

### Diagnóstico de datos identificado

- `cotizaciones.approval_days`: 0 registros poblados — se calcula en tiempo real con
  `approved_on − created_on`.
- `cotizaciones.approved_on`: 125 de 646 registros tienen fecha; marzo tiene 89 aprobadas sin
  `approved_on` (71% sin cobertura). Se documenta como deuda de datos.

---

## 2026-04-24 — Despliegue Raspberry Pi, ngrok, fix sincronización CSV, update-safe.sh

### Docker / nginx

- `docker/nginx/default.conf`: corregido `proxy_pass` (sin puerto en upstream); añadidos headers
  `X-Forwarded-*`; eliminado bloque `/n8n/` no usado.
- `docker/nginx/default.prod.conf`: vaciado (SSL no aplicable en despliegue actual con ngrok).
- `docker-compose.yml`: añadido ARG `VITE_API_URL` en build de frontend; nuevo servicio `ngrok`
  con dominio estático `caress-shortlist-disarm.ngrok-free.dev`.

### Frontend

- `frontend/Dockerfile`: añadido `ARG VITE_API_URL=` + `ENV` antes de `npm run build` para
  inyectar variables Vite en tiempo de build.
- `frontend/nginx.conf`: añadido bloque `/api/` para proxy desde puerto 5173 al backend.

### Sincronización CSV (Alembic / sync_service)

- `20260419_0002_import_csv_data.py`:
  - `_bulk_upsert`: filtra columnas al subconjunto existente en BD en el momento de la migración.
  - `_bulk_upsert`: deduplicación por `conflict_cols` y PK antes de insertar.
  - `_import_quote_items`: deduplicación global por `id` y `(quote_id, line_external_id)`;
    `conflict_cols` cambiado a `["id"]`.
- `sync_service.py`: añadido `--skip-rollups` al subproceso (función `app.recompute_all_rollups`
  no existe en BD).

### Scripts

- `scripts/update-safe.sh` (NUEVO): actualización segura de 7 pasos con backup pre-update,
  restore antes de migraciones, y soporte `--dry-run`. Ver
  `docs/despliegue_raspberry_pi_2026-04-24.md`.

---

## 2026-04-21 — Dashboard de Ventas (riesgo + pagos) y hardening de API

### Backend (FastAPI)

- Ventas:
  - Se agregó endpoint `GET /api/ventas/payment-trend` para obtener tendencia de días de pago por cliente.
    - Fuente: `pedidos_clientes` (CustomerOrder).
    - Cálculo: `promedio_dias_pago = AVG(paid_on - invoiced_on)` (en días) por cliente, con `paid_on` e `invoiced_on` no nulos.
    - Filtros: `paid_on` dentro de `[start_date, end_date]` cuando se envían.
    - Salida: `{ customer_name, promedio_dias_pago, ultimo_pago, riesgo_pago }` con semáforo:
      - Bajo: `<= 30`
      - Medio: `<= 60`
      - Alto: `> 60`
  - Se agregó endpoint `GET /api/ventas/at-risk-customers` para clientes con caída de compras.
    - Fuente: `ventas`.
    - Cálculo: suma últimos 90 días vs 90 días previos; clasificación de riesgo (Bajo/Medio/Alto/Crítico).

- Auth:
  - Se mejoró el manejo de error cuando `JWT_SECRET` no está configurado (login/refresh devuelven 500 con `detail` explícito).

- CORS y manejo de errores:
  - Se amplió la detección de ambiente local para permitir orígenes por defecto cuando `ENV` sea `development/dev/local`.
  - Se agregó handler global de excepciones para retornar JSON consistente y permitir que CORS aplique headers aun en errores 500.

### Frontend (React)

- Dashboard de Ventas:
  - Ajustes visuales (layout) en paneles relacionados a demanda/pagos/riesgo para mantener proporciones en pantallas XL.
  - Consumo de endpoints de riesgo y tendencia de pagos vía `ventasService`.

### Docker / Entorno

- `docker-compose.yml`:
  - Fuerza `ENV=development` en servicio backend para asegurar CORS por defecto en dev.
  - Monta `./scripts` como `/scripts` dentro del contenedor backend (necesario para ejecutar `scripts/bootstrap_triggers.sql` durante pruebas).

- `docker-compose.prod.yml`:
  - Fuerza `ENV=production` en servicio backend.

### Operación BD (scripts)

- Makefile:
  - Nuevos targets `make setup-db` y `make restore-latest` para acelerar operaciones de entorno local.
- `scripts/setup-db.sh`:
  - Setup end-to-end: levanta servicios, aplica migraciones, bootstrap de triggers, carga CSV (replace) y genera backup.
  - Admin: se crea/actualiza solo si `ADMIN_EMAIL` y `ADMIN_PASSWORD` están definidos en `.env` (sin credenciales hardcodeadas).
  - Reset opcional: `SETUP_DB_RESET=true` para recrear la base de datos.
- `scripts/restore-db.sh`:
  - Si no se pasa archivo, auto-selecciona el backup más reciente en `data/backups/`.
- `backend/scripts/create_admin_user.py`:
  - Script de upsert del usuario por email (actualiza password/rol si ya existe).
- `docs/database_sync_runbook.md`:
  - Se documenta recuperación y flujos de backup/restore + creación de admin, evitando secretos en texto plano.

### Tests

- Se reforzó la inicialización de la BD de tests:
  - Reset completo del schema `public` (DROP/CREATE) para garantizar un esquema limpio y evitar residuos de tablas/vistas.
  - Se mantiene el schema `staging` para tablas auxiliares.
- Se agregaron/ajustaron pruebas de endpoints de ventas:
  - `payment-trend` (tendencia de pago).
  - Ajuste de aserción de porcentaje por precisión de punto flotante con `pytest.approx`.

### Migraciones (Alembic)

- Se ajustaron `down_revision` en algunas migraciones para mantener la cadena de dependencias consistente.

### Verificación

- Backend tests (en Docker): `docker compose run --rm backend pytest -q`

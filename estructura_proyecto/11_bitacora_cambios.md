# Bitácora de Cambios (sesiones)

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

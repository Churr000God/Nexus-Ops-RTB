# Nexus Ops RTB — Documentación Maestra

> **Estado:** Producción activa  
> **Última actualización:** 2026-05-06  
> **Versión del documento:** 1.0

---

## Presentación del Proyecto

Nexus Ops RTB es un sistema de operaciones interno desarrollado para RTB (Refacciones y Accesorios). Centraliza en una sola interfaz web todos los flujos operativos de la empresa: ventas, compras, inventario, logística, facturación CFDI 4.0 y reportes analíticos.

El sistema reemplaza y complementa el ERP operativo en Notion: Notion sigue siendo la fuente primaria de datos ingresados por el equipo comercial, pero Nexus Ops expone esa información en una interfaz más rápida, controlada y con capacidades que Notion no ofrece (RBAC, auditoría, CFDI, analytics, 2FA, multi-sesión).

**Quién lo usa:**
- Operativos de ventas y compras (captura, seguimiento)
- Logística y almacén (empacado, envíos, inventario físico)
- Administración (facturación, cobranza, reportes)
- IT / Admin (gestión de usuarios, roles, catálogos SAT)

**Alcance real (mayo 2026):**
- 34 migraciones Alembic aplicadas en Supabase
- 22 routers FastAPI registrados, 150+ endpoints
- 60+ rutas en el frontend React
- 17 flujos n8n activos sincronizando datos desde Notion
- Pipeline CI/CD automatizado en AWS (CodePipeline → EC2)

---

# Parte I — Arquitectura del Sistema

## 1. Diagrama de servicios (runtime)

### Desarrollo (local / WSL2)

```
  Internet / ngrok tunnel
          │
          ▼
  ┌───────────────┐
  │  ngrok/CF     │  puerto 80 expuesto al exterior
  └──────┬────────┘
         │
         ▼
  ┌───────────────┐
  │  nginx proxy  │  :80
  │  (1.27-alpine)│
  └────┬──────────┘
       │ /api/*            │ /*
       ▼                   ▼
  ┌──────────┐      ┌─────────────┐
  │ backend  │      │  frontend   │
  │ FastAPI  │      │  nginx      │
  │ :8000    │      │  (Vite SPA) │
  └────┬─────┘      └─────────────┘
       │
       ├──── Redis :6379 (cache, sesiones)
       │
       └──── Supabase PostgreSQL (externo, cloud)
                    ▲
              relay TCP (host.docker.internal)
              necesario en WSL2

  n8n :5678 ──── postgres-n8n (solo para n8n)
```

### Producción (EC2 Amazon Linux 2023)

```
  Internet
     │
     ▼
  Cloudflare Tunnel (cloudflared)
     │
     ▼
  ┌───────────────────────────────┐
  │  nginx proxy  :80/:443        │
  │  (docker-compose.prod.yml)    │
  └────┬──────────────────────────┘
       │ /api/*            │ /*
       ▼                   ▼
  ┌──────────┐      ┌─────────────┐
  │ backend  │      │  frontend   │
  │ 4 workers│      │  nginx SPA  │
  └────┬─────┘      └─────────────┘
       │
       ├──── Redis :6379
       │
       └──── Supabase PostgreSQL (URL directa)

  Sin n8n en producción EC2
  (n8n corre en instancia separada o en dev)
```

## 2. Stack tecnológico completo con versiones

### Backend

| Componente | Versión |
|-----------|---------|
| Python | 3.12 |
| FastAPI | 0.115.12 |
| Uvicorn | 0.34.2 |
| SQLAlchemy | 2.0.41 |
| Alembic | 1.16.4 |
| psycopg (driver) | 3.2.10 (psycopg[binary]) |
| Redis client | 6.2.0 |
| pydantic-settings | 2.10.1 |
| python-jose | 3.5.0 (JWT) |
| passlib[bcrypt] | 1.7.4 |
| pyotp | 2.9.0 (TOTP 2FA) |
| loguru | 0.7.3 |
| ruff | 0.6.9 (linter) |
| mypy | 1.11.2 |

### Frontend

| Componente | Versión |
|-----------|---------|
| React | 18.3.1 |
| TypeScript | 5.7.3 |
| Vite | 6.0.11 |
| React Router DOM | 7.14.1 |
| Tailwind CSS | 3.4.17 |
| shadcn/ui (Radix + CVA) | componentes sin versión fija |
| Zustand | 5.0.12 |
| Recharts | 3.8.1 |
| Lucide React | 1.8.0 |
| Sonner (toasts) | 2.0.7 |
| react-qr-code | 2.0.15 |
| eslint-plugin-react-hooks | 7.1.1 |

### Infraestructura

| Componente | Versión / Detalle |
|-----------|-------------------|
| Base de datos | Supabase (PostgreSQL 15, gestionado en nube) |
| Redis | 7-alpine (Docker) |
| Nginx | 1.27-alpine |
| n8n | latest (auto-update desactivado en prod) |
| PostgreSQL (solo n8n) | 16-alpine |
| Cloudflare Tunnel | cloudflared:latest |
| Docker Buildx | 0.20.0 |
| Docker Compose | v2 |
| EC2 | Amazon Linux 2023 |

## 3. Árbol de directorios real del proyecto

```
Nexus_Ops_RTB/
├── CLAUDE.md                          # Instrucciones para Claude Code
├── README.md
├── buildspec.yml                      # AWS CodeBuild — lint + typecheck + empaquetar
├── appspec.yml                        # AWS CodeDeploy — destino + hooks
├── docker-compose.yml                 # Stack completo de desarrollo
├── docker-compose.prod.yml            # Overrides de producción (sin n8n, +cloudflared)
├── Makefile
│
├── backend/
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── alembic/
│   │   └── versions/                  # 34+ migraciones .py
│   └── app/
│       ├── main.py                    # Punto de entrada FastAPI, registro de routers
│       ├── config.py                  # Settings con pydantic-settings
│       ├── db.py                      # Engine async + get_db dependency
│       ├── dependencies.py            # get_current_user, require_permission, etc.
│       ├── middleware/
│       │   ├── cors.py
│       │   ├── logging.py
│       │   └── auth_middleware.py
│       ├── models/                    # SQLAlchemy ORM models
│       │   ├── base.py
│       │   ├── user_model.py
│       │   ├── ops_models.py
│       │   ├── productos_pricing_models.py
│       │   ├── clientes_proveedores_models.py
│       │   ├── ventas_logistica_models.py
│       │   ├── compras_models.py
│       │   ├── assets_models.py
│       │   ├── cfdi_models.py
│       │   └── staging_models.py
│       ├── routers/                   # Endpoints FastAPI
│       │   ├── auth.py
│       │   ├── usuarios.py
│       │   ├── admin.py
│       │   ├── dashboard.py
│       │   ├── ventas.py
│       │   ├── ventas_logistica.py
│       │   ├── compras.py
│       │   ├── inventario.py
│       │   ├── assets.py
│       │   ├── productos.py
│       │   ├── clientes_proveedores.py
│       │   ├── cfdi.py
│       │   ├── analytics.py
│       │   ├── reportes.py
│       │   ├── sat_admin.py
│       │   ├── sync.py
│       │   ├── health.py
│       │   └── ...
│       ├── schemas/                   # Pydantic v2 schemas
│       ├── services/                  # Lógica de negocio
│       └── utils/
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── eslint.config.js
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── routes.tsx                 # Definición completa de rutas React Router v7
│       ├── components/
│       │   ├── layout/               # AppShell, Header, Sidebar
│       │   ├── common/               # DataTable, formularios reutilizables
│       │   ├── dashboards/
│       │   ├── charts/
│       │   └── ui/                   # shadcn/ui primitivos
│       ├── pages/                    # Una carpeta por módulo
│       │   ├── admin/
│       │   ├── catalogos/
│       │   ├── cobranza/
│       │   ├── compras/
│       │   ├── cuenta/
│       │   ├── facturacion/
│       │   ├── logistica/
│       │   ├── proveedores/
│       │   ├── reportes/
│       │   └── ventas/
│       ├── stores/                   # Zustand stores
│       │   ├── authStore.ts
│       │   └── syncStore.ts
│       ├── hooks/
│       ├── services/                 # Funciones fetch por módulo
│       ├── types/
│       └── lib/
│
├── docker/
│   ├── nginx/
│   │   ├── default.conf              # Config dev (sin TLS)
│   │   └── default.prod.conf         # Config prod (con TLS / cloudflare)
│   └── cloudflared/
│
├── scripts/
│   ├── init-project.sh               # Arranque dev completo
│   ├── init-dev.ps1                  # Arranque PowerShell (WSL2)
│   ├── setup-db.sh
│   ├── backup-db.sh
│   ├── restore-db.sh
│   ├── stop.sh
│   ├── update-safe.sh
│   ├── health-check.sh
│   └── codedeploy/
│       ├── before_install.sh
│       ├── after_install.sh
│       ├── application_start.sh
│       └── validate_service.sh
│
├── automations/
│   ├── n8n_flows/                    # 17 flujos JSON versionados
│   └── n8n_data/                     # Datos persistentes n8n (no en git)
│
├── data/
│   ├── csv/                          # CSVs de catálogos SAT, productos
│   ├── backups/                      # Backups pg_dump
│   └── reports/
│
├── contexto/                         # Documentación de negocio RTB
├── estructura_proyecto/              # Especificaciones técnicas del sistema
└── docs/                             # Documentación técnica y changelogs
```

## 4. Principios de arquitectura y decisiones de diseño

El sistema sigue una arquitectura de capas clara tanto en backend como en frontend. La comunicación entre servicios se hace exclusivamente por HTTP (REST). No se usa WebSockets ni colas de mensajes propias — Redis se usa solo para cache y sesiones de refresh token, no como bus de eventos.

La base de datos es externa y gestionada (Supabase), lo que elimina la operación del motor PostgreSQL pero requiere gestión del connection relay en desarrollo bajo WSL2.

El frontend no usa React Query ni ninguna librería de server-state. El patrón establecido es `useEffect(() => { fetch(..., { signal }) })` con AbortController, lo que da control explícito sobre cancelación de peticiones.

---

# Parte II — Base de Datos

## 1. Supabase como base de datos

Supabase provee un cluster PostgreSQL 15 gestionado en la nube (AWS us-east-1). La aplicación se conecta directamente como si fuera PostgreSQL estándar vía `psycopg3`.

**Ventajas frente a un contenedor postgres local:**
- Backups automáticos gestionados por Supabase
- No hay volúmenes Docker de postgres que destruir accidentalmente
- La BD es accesible desde cualquier entorno (dev, CI, prod) sin túneles de BD
- Escalado y monitoreo incluidos

**Consideración importante en desarrollo (WSL2):**
Docker corre dentro de WSL2 y no resuelve directamente el hostname de Supabase. Se usa un relay TCP local que escucha en `host.docker.internal:5432` y redirige al host Supabase real. La variable `DATABASE_URL_DOCKER` apunta al relay; `DATABASE_URL` apunta directo a Supabase. En producción (EC2 con IP pública) se usa `DATABASE_URL` directa.

**Lo que NO existe:**
- No hay contenedor `postgres` en `docker-compose.yml` para la app
- Solo existe `postgres-n8n` (PostgreSQL 16-alpine) exclusivamente para almacenar los datos internos de n8n

## 2. Esquema de migraciones organizadas por módulo

Las migraciones Alembic siguen el patrón `YYYYMMDD_NNNN_descripcion.py`. La numeración es la fuente de orden canónico.

| Migración | Módulo | Contenido principal |
|-----------|--------|---------------------|
| 0001 | Auth | Tablas `users` y `refresh_tokens` |
| 0002 | Datos | Import inicial de CSV (catálogos base) |
| 0003 | Ops Core | Estructura RTB: cotizaciones, pedidos, ventas, compras, inventario (datos desde Notion) |
| 0004 | Ops Core | Diferencia ventas vs PO, campos planos |
| 0005-0007 | Ops Core | `updated_at`, observaciones, no conformes |
| 0009 | Ops Core | Fix rollups y campos de periodo en ventas |
| 0010 | Seguridad | RBAC: tablas `roles`, `permissions`, `user_roles`, `audit_log`; trigger `fn_audit_changes` |
| 0011 | Seguridad | Seed completo de roles y permisos |
| 0012 | Productos | DDL: `products`, `product_categories`, `product_brands`, `price_lists`, `price_list_items` |
| 0013 | Productos | Triggers y función `fn_get_quote_pricing` |
| 0014 | Clientes/Proveedores | 11 tablas: `customers`, `suppliers`, `customer_contacts`, `supplier_contacts`, etc. |
| 0015 | Ventas/Logística | DDL: 21 tablas — `delivery_notes`, `quotes`, `orders`, `shipments`, `cfdi`, `payments`, etc. |
| 0016 | Ventas/Logística | 5 vistas SQL + 4 triggers (estado pedidos, pagos, empacado) |
| 0017 | Compras | DDL: `purchase_requests`, `purchase_orders`, `po_items`, `goods_receipts`, etc. |
| 0018 | Compras | 5 triggers + vista `v_purchase_chain` |
| 0019 | Inventario/Assets | Deuda técnica: rename `inventory_movements`, foreign keys |
| 0020 | Inventario/Assets | DDL: `assets`, `asset_snapshots`, `asset_categories`, `asset_assignments` |
| 0021 | Inventario/Assets | 6 vistas + triggers pg_cron para snapshots automáticos |
| 0022 | CFDI | DDL: `cfdi_issuer_config`, `cfdi_series`, `pac_log`; ALTER a tablas cfdi existentes |
| 0023 | CFDI | Función `fn_assign_cfdi_folio`, vista `v_cfdi_ppd_pending_payment` |
| 0025 | Mi Cuenta | Multi-sesión en `refresh_tokens` (device_name, last_used_at, ip_address) |
| 0026 | Auth | `password_reset_tokens` |
| 0027 | Auth | TOTP 2FA: campos en `users` (totp_secret, totp_enabled, backup_codes) |
| 0028 | Assets | `asset_assignment_history` |
| 0029 | Assets | Campos de retiro en `assets` |
| 0030 | Inventario | `physical_counts` y `physical_count_lines` |
| 0031 | Assets | Jerarquía padre-hijo en activos |
| 0032 | Assets | `asset_work_orders` |
| 0033 | Assets | `asset_depreciation_config` |
| 0034 | Inventario | `product_count_lines` |

## 3. Convenciones de nomenclatura

- **Tablas operativas:** snake_case en español cuando reflejan entidades del negocio RTB (e.g., `cotizaciones`, `pedidos_clientes`, `facturas_compras`). Las tablas nuevas del sistema moderno usan inglés técnico (e.g., `delivery_notes`, `purchase_orders`, `assets`).
- **Tablas de auth:** inglés siempre (`users`, `refresh_tokens`, `password_reset_tokens`).
- **Tablas de seguridad/RBAC:** inglés (`roles`, `permissions`, `user_roles`, `audit_log`).
- **Vistas SQL:** prefijo `v_` (e.g., `v_purchase_chain`, `v_cfdi_ppd_pending_payment`).
- **Funciones SQL:** prefijo `fn_` (e.g., `fn_audit_changes`, `fn_get_quote_pricing`, `fn_assign_cfdi_folio`).
- **Columnas:** snake_case siempre. Claves primarias: `id` (UUID o serial). Timestamps: `created_at`, `updated_at`.

## 4. Triggers y funciones SQL relevantes

| Nombre | Tipo | Propósito |
|--------|------|-----------|
| `fn_audit_changes` | Trigger function | Se ejecuta en INSERT/UPDATE/DELETE de tablas auditadas. Registra en `audit_log` el usuario, tabla, tipo de operación y datos old/new como JSONB. |
| `fn_get_quote_pricing` | Function | Calcula pricing de una cotización dado el `quote_id` y `price_list_id`. Devuelve tabla con `product_id`, `unit_price`, `subtotal`. |
| `fn_assign_cfdi_folio` | Function | Asigna folio secuencial a un CFDI dentro de su serie, garantizando unicidad con `LOCK TABLE ... IN SHARE ROW EXCLUSIVE MODE`. |
| `fn_recalc_inventario` (alias) | Trigger | Recalcula stock teórico y real post-sincronización desde n8n. Ajusta `cantidad_teorica`, `cantidad_real`, `diferencia_stock`. |
| `pg_cron` snapshots | Cron job | Genera snapshots diarios automáticos de assets para histórico de depreciation. |

## 5. Alembic — gestión de migraciones

```bash
# Aplicar todas las migraciones pendientes
docker compose exec backend alembic upgrade head

# Crear nueva migración autogenerada
docker compose exec backend alembic revision --autogenerate -m "descripcion"

# Ver estado actual
docker compose exec backend alembic current

# Ver historial
docker compose exec backend alembic history --verbose

# Revertir una migración
docker compose exec backend alembic downgrade -1
```

**Regla obligatoria:** Las migraciones de datos (INSERT, UPDATE, seed) deben ir **siempre después** de todas las DDL (CREATE TABLE, ALTER TABLE) en el mismo archivo o en un archivo de migración posterior. Nunca mezclar DDL con DML en el mismo `op.execute()` si el DML depende de que la DDL esté completa.

**Anti-patrón a evitar:** No usar `Base.metadata.create_all()` dentro de una migración sin filtrar las tablas. Esto crea tablas de migraciones futuras que aún no deberían existir.

## 6. Backup y recuperación

```bash
# Crear backup comprimido en data/backups/
bash ./scripts/backup-db.sh

# Restaurar el backup más reciente
bash ./scripts/restore-db.sh

# Restaurar un backup específico
bash ./scripts/restore-db.sh data/backups/backup_2026-05-06.sql.gz

# Setup completo desde cero (migraciones + triggers + CSVs + usuario admin)
bash ./scripts/setup-db.sh
```

Los backups usan `pg_dump` de Supabase comprimido con gzip. Se almacenan en `data/backups/` (excluido del artefacto de deploy por `buildspec.yml`).

---

# Parte III — Backend (FastAPI)

## 1. Stack y dependencias

El backend es una API REST asíncrona. Cada request se maneja en un worker async de uvicorn. La base de datos se accede exclusivamente por SQLAlchemy async con psycopg3 como driver. No hay ORM síncrono en el proyecto.

En producción se levantan 4 workers uvicorn (`--workers 4`) para aprovechar múltiples CPUs.

## 2. Estructura de capas

```
Request HTTP
     │
     ▼
Router (app/routers/*.py)
  - Validación de request (Pydantic schema)
  - Autenticación (Depends(get_current_user))
  - Autorización (Depends(require_permission("permiso")))
     │
     ▼
Service (app/services/*.py)
  - Lógica de negocio
  - Queries SQLAlchemy async
  - Transacciones (commit explícito)
     │
     ▼
Model (app/models/*.py)
  - Clases ORM SQLAlchemy 2.x
  - Mapped[tipo] annotations
     │
     ▼
Supabase PostgreSQL (vía psycopg3)
```

Los schemas Pydantic v2 viven en `app/schemas/` separados por módulo. Hay schemas de request (sufijo `Create`, `Update`) y de response (sufijo `Response`). Los schemas de request se definen como `type`, no `interface`, para evitar problemas de index signature al serializar.

## 3. Módulos implementados con sus prefijos de URL

| Módulo | Prefijo | Endpoints aprox. |
|--------|---------|------------------|
| Health | `/health` | 1 — GET /health |
| Auth | `/api/auth` | 12 — login, register, refresh, logout, 2FA setup/verify, perfil, sesiones, cambio de password, reset |
| Usuarios (admin) | `/api/usuarios` | 8 — CRUD de usuarios, roles |
| Admin general | `/api/admin` | 6 — audit log, configuración fiscal, series CFDI, SAT sync |
| Dashboard | `/api/dashboard` | 5 — KPIs de ventas, compras, inventario |
| Ventas (legacy ops) | `/api/ventas` | 10 — ventas desde sync Notion, cotizaciones históricas |
| Ventas/Logística | `/api/ventas-logistica` | 31 — notas remisión, cotizaciones, pedidos, empacado, envíos, pagos, rutas, fleteras |
| Compras | `/api/compras` | 22 — solicitudes, órdenes, recepciones, facturas proveedor |
| Gastos | `/api/gastos` | 4 — CRUD gastos operativos |
| Inventario | `/api/inventario` | 15 — movimientos, ajustes, conteos físicos, bitácora |
| Activos (Assets) | `/api/activos` | 20+ — equipos, snapshots, asignaciones, órdenes de trabajo |
| Productos | `/api/productos` | 17 — catálogo, pricing, marcas, categorías, claves SAT |
| Clientes | `/api/clientes` | 12 — CRUD clientes, contactos, direcciones |
| Proveedores | `/api/proveedores` | 12 — CRUD proveedores, contactos, catálogo de productos |
| CFDI | `/api/cfdi` | 15 — emisión, cancelación, complementos de pago, notas crédito, PAC log |
| Analytics | `/api/analytics` | 20 — vistas analíticas de ventas, compras, inventario, margenes, cashflow |
| Reportes | `/api/reportes` | 8 — exportaciones, KPIs históricos |
| SAT Admin | `/api/admin/sat` | 8 — sincronización y consulta de catálogos SAT (52k+ claves) |
| Sync | `/api/sync` | 3 — trigger manual de sincronización n8n |

## 4. Patrones obligatorios

### psycopg3 y CAST

El driver psycopg3 requiere tipos explícitos en los parámetros de consulta SQL. La sintaxis PostgreSQL directa `::tipo` falla con psycopg3.

```python
# CORRECTO
await db.execute(
    text("SELECT * FROM products WHERE id = CAST(:id AS uuid)"),
    {"id": product_id}
)

# INCORRECTO (genera error con psycopg3)
await db.execute(
    text("SELECT * FROM products WHERE id = :id::uuid"),
    {"id": product_id}
)

# Para parámetros nullable:
text("UPDATE assets SET retired_at = CAST(:retired_at AS timestamptz)")
```

### SQLAlchemy async — patrones obligatorios

```python
# Commit explícito siempre (no autocommit)
async def create_item(db: AsyncSession, payload: ItemCreate) -> Item:
    item = Item(**payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

# Eager-load de relaciones ANTES de serializar con Pydantic
# (las relaciones lazy no funcionan fuera del contexto async)
result = await db.execute(
    select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
)
order = result.scalar_one_or_none()
# Ahora es seguro acceder a order.items en el schema Pydantic
```

### CORS en respuestas de error 500

FastAPI por defecto no agrega headers CORS a las respuestas de error no manejadas. El middleware de CORS se registra en `configure_cors()` antes del exception handler global, y el exception handler devuelve `JSONResponse` directamente (no usa `raise HTTPException`) para que el middleware pueda agregar los headers CORS antes de enviar la respuesta.

### Manejo de errores de BD en `get_db`

La dependencia `get_db` captura `SQLAlchemyError` para que los errores de conexión no escapen la capa CORS:

```python
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except SQLAlchemyError as exc:
            await session.rollback()
            raise HTTPException(status_code=503, detail="Error de base de datos") from exc
```

## 5. Autenticación y RBAC

### Flujo de autenticación completo

```
POST /api/auth/login  {email, password}
         │
         ▼ (credenciales válidas + TOTP requerido)
         │
    Si totp_enabled=False y primera vez:
         └─── MfaChallengeResponse {mfa_token, requires_setup: true}
                   │
                   ▼
              POST /api/auth/2fa/setup    → {secret, qr_uri}
              POST /api/auth/2fa/confirm  → activa 2FA, devuelve access + refresh

    Si totp_enabled=True:
         └─── MfaChallengeResponse {mfa_token, requires_setup: false}
                   │
                   ▼
              POST /api/auth/2fa/verify {mfa_token, totp_code}
                   └─── TokenResponse {access_token} + Set-Cookie: refresh_token
                                            │
                                            ▼
                              POST /api/auth/refresh  (usa cookie httpOnly)
                                   └─── RefreshResponse {access_token}
```

- **Access token:** JWT HS256, expira en 30 minutos. Enviado en header `Authorization: Bearer <token>`.
- **Refresh token:** Opaco (UUID), almacenado en BD (`refresh_tokens`), enviado como cookie `httpOnly; SameSite=Strict; path=/api/auth`. Expira en 7 días.
- **MFA token:** Token de vida corta generado tras login exitoso, necesario para completar el flujo 2FA. No es un access token.
- **TOTP:** Implementado con `pyotp`. Secret almacenado en `users.totp_secret`. Backup codes generados al activar. 2FA es **obligatorio** para todos los usuarios.

### RBAC

El sistema tiene **dos capas de roles**:

1. **Rol legacy** (`users.role`): Columna string en `users` con valores `admin`, `operativo`, `lectura`, `driver`. Usado para control de acceso grueso.
2. **RBAC granular** (migración 0010): Tablas `roles`, `permissions`, `user_roles`, `role_permissions`. Un usuario puede tener múltiples roles RBAC independientes del rol legacy.

**Los 7 roles en BD:**

| Rol | Descripción |
|-----|-------------|
| `admin` | Acceso completo al sistema |
| `operativo` | Ventas, compras, inventario operativo |
| `lectura` | Solo consulta, sin escritura |
| `driver` | Módulo de envíos y logística |
| `facturacion` | Módulo CFDI y cobranza |
| `compras` | Módulo de compras completo |
| `inventario` | Módulo de inventario y activos |

La dependencia `require_permission("nombre.permiso")` verifica en `user_roles → role_permissions → permissions` si el usuario tiene el permiso específico.

### Audit log

El trigger `fn_audit_changes` registra automáticamente cambios en tablas críticas (ventas, compras, inventario, usuarios) en la tabla `audit_log` con: `user_id`, `table_name`, `operation` (INSERT/UPDATE/DELETE), `old_data` (JSONB), `new_data` (JSONB), `created_at`.

## 6. Integración con n8n

Los flujos n8n hacen POST a `POST /api/sync/{entidad}` con un token de autenticación en el header `X-Sync-Key: {SYNC_API_KEY}`. El endpoint recibe los datos normalizados en JSON, los inserta/actualiza en las tablas de staging y luego ejecuta el merge hacia las tablas operativas.

El backend también puede disparar flujos de n8n vía `POST /api/sync/trigger` cuando necesita forzar una sincronización manual (ej.: tras un cambio en el catálogo de productos).

---

# Parte IV — Frontend (React + TypeScript)

## 1. Stack y dependencias

React 18 con TypeScript estricto. Bundler: Vite 6. Routing: React Router DOM 7 (data router pattern no usado — se usa el API clásico de `<Routes>`).

**Sin React Query:** El proyecto no usa React Query ni SWR. El patrón de fetching es fetch nativo con AbortController/AbortSignal. Esto es una decisión de diseño deliberada para mantener el control explícito del ciclo de vida de las peticiones.

**Gestión de estado global:** Zustand con dos stores:
- `authStore.ts`: usuario autenticado, token, estado de sesión (`booting | authenticated | unauthenticated`)
- `syncStore.ts`: estado de las sincronizaciones n8n en curso

## 2. Estructura de la aplicación

El punto de entrada es `main.tsx` → `App.tsx` → `AppRoutes()` (en `routes.tsx`). Las rutas protegidas se envuelven en `<RequireAuth>` que verifica el estado del `authStore`. Las rutas autenticadas usan `<Shell>` que renderiza `<AppShell>` con sidebar y header.

```
main.tsx
  └─ App.tsx (BrowserRouter)
       └─ AppRoutes()
            ├─ /login, /forgot-password, /reset-password
            ├─ /setup-2fa, /verify-2fa
            └─ <RequireAuth>
                 └─ <Shell> (AppShell con sidebar)
                      ├─ / (Dashboard)
                      ├─ /ventas/*
                      ├─ /logistica/*
                      ├─ /compras/*
                      ├─ /inventario
                      ├─ /equipos, /activos/*
                      ├─ /clientes, /proveedores/*
                      ├─ /catalogos/*
                      ├─ /facturacion/*
                      ├─ /cobranza/*
                      ├─ /reportes/*
                      ├─ /admin/*
                      └─ /cuenta/*
```

## 3. Módulos y páginas implementadas

| Módulo | Rutas | Páginas |
|--------|-------|---------|
| Ventas | `/ventas/cotizaciones`, `/ventas/pedidos`, `/ventas/notas-remision`, `/ventas/operacional`, `/ventas/reportes` | CotizacionesPage, PedidosPage, NotasRemisionPage, VentasOperacional, VentasPage |
| Logística | `/logistica/empacado`, `/logistica/envios`, `/logistica/rutas`, `/logistica/fleteras` | EmpacadoPage, EnviosPage, RutasPage, FleterasPage |
| Compras | `/compras/solicitudes`, `/compras/ordenes`, `/compras/recepciones`, `/compras/facturas`, `/compras/gastos` | SolicitudesPage, OrdenesPage, RecepcionesPage, FacturasProveedorPage, GastosPage |
| Inventario | `/inventario`, `/activos/conteos` | AlmacenPage (Inventarios), ConteosPage |
| Activos/Equipos | `/equipos` | EquiposPage |
| Clientes | `/clientes` | ClientesPage |
| Proveedores | `/proveedores`, `/proveedores/catalogo` | ProveedoresMaestroPage, CatalogoPage |
| Catálogos | `/catalogos/productos`, `/catalogos/marcas`, `/catalogos/categorias` | ProductosCatalogoPage, MarcasPage (árbol), CategoriasPage (árbol) |
| Facturación | `/facturacion`, `/facturacion/emitir`, `/facturacion/complementos`, `/facturacion/notas-credito`, `/facturacion/cancelaciones`, `/facturacion/pac-log` | CfdiPage, EmitirCfdiPage, ComplementosPagoPage, NotasCreditoPage, CancelacionesPage, PacLogPage |
| Cobranza | `/cobranza/ar`, `/cobranza/ap`, `/cobranza/pagos`, `/cobranza/sin-aplicar`, `/cobranza/flujo` | ArPage, ApPage, PagosPage, SinAplicarPage, FlujoCajaPage |
| Reportes | `/reportes/comercial`, `/reportes/margen`, `/reportes/operacion`, `/reportes/compras`, `/reportes/financiero` | ComercialPage, MargenPage, OperacionPage, ComprasReportesPage, FinancieroPage |
| Admin | `/admin/usuarios`, `/admin/roles`, `/admin/fiscal`, `/admin/series`, `/admin/sat`, `/admin/audit-log` | AdminUsuariosPage, RolesPage, FiscalPage, SeriesPage, SatPage, AdminAuditLogPage |
| Mi Cuenta | `/cuenta/perfil`, `/cuenta/password`, `/cuenta/sesiones` | PerfilPage, PasswordPage, SesionesPage |
| Auth | `/login`, `/forgot-password`, `/reset-password`, `/setup-2fa`, `/verify-2fa` | LoginPage, ForgotPasswordPage, ResetPasswordPage, SetupTwoFaPage, VerifyTwoFaPage |

## 4. Patrones del proyecto

### DataTable API

El componente `DataTable` usa la siguiente API. **No usar props de otras versiones.**

```tsx
// Correcto
<DataTable
  rows={items}                         // datos (array)
  rowKey={(row) => row.id}             // función de key
  columns={[
    { key: "name", header: "Nombre", cell: (row) => row.name },
    { key: "status", header: "Estado", cell: (row) => <Badge>{row.status}</Badge> }
  ]}
  emptyLabel="Sin resultados"
  fetcher={(signal) => fetchItems(signal)}  // recibe AbortSignal
/>

// Incorrecto (no usar)
// render, data, emptyMessage, loading
```

### AppShell height

El `main` del AppShell debe ser `h-screen` (no `min-h-screen`) para que el scroll interno funcione en páginas con layout master-detail:

```tsx
// AppShell.tsx — correcto
<main className="h-screen overflow-y-auto flex-1">
  <Outlet />
</main>
```

### Zustand stores

```typescript
// authStore.ts — pattern de uso
const { user, status, isAuthenticated } = useAuth()
// status: "booting" | "authenticated" | "unauthenticated"
```

### Tipado TypeScript — convenciones

1. **Payloads de request** deben ser `type`, no `interface`:
   ```typescript
   // Correcto
   type CreateProductPayload = { name: string; sku: string }
   
   // Incorrecto para payloads (causa error de index signature con JsonValue)
   interface CreateProductPayload { name: string; sku: string }
   ```

2. **Union literals con valor por defecto:** el default debe estar tanto en el `type` como en todos sus `Record`:
   ```typescript
   type Status = "active" | "inactive" | "pending"
   const LABELS: Record<Status, string> = {
     active: "Activo",
     inactive: "Inactivo",
     pending: "Pendiente"  // si se agrega al type, debe estar aquí también
   }
   ```

3. Siempre correr `npm --prefix frontend run typecheck` antes de hacer build de producción.

### ESLint con react-hooks v7

La versión 7 de `eslint-plugin-react-hooks` introdujo reglas nuevas (`set-state-in-effect`, `static-components`) que generan falsos positivos con el patrón fetch nativo. Se hace override manual en `eslint.config.js`:

```javascript
// eslint.config.js — override para react-hooks v7
{
  rules: {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    // Las reglas nuevas de v7 se desactivan porque generan falsos positivos
    // con el patrón useEffect + fetch nativo usado en todo el proyecto
  }
}
```

## 5. Comunicación con el backend

Todas las llamadas al backend usan `fetch` nativo. La URL base se construye a partir de `import.meta.env.VITE_API_URL` que en producción es vacío (paths relativos resueltos por nginx).

```typescript
// Patrón estándar de fetching
export async function fetchCotizaciones(signal: AbortSignal) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/ventas-logistica/quotes`, {
    headers: { Authorization: `Bearer ${getToken()}` },
    signal,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<QuoteResponse[]>
}

// En el componente
useEffect(() => {
  const ctrl = new AbortController()
  fetchCotizaciones(ctrl.signal)
    .then(setData)
    .catch(err => { if (err.name !== "AbortError") setError(err) })
  return () => ctrl.abort()
}, [])
```

Los tokens de acceso se almacenan en memoria (Zustand `authStore`), no en `localStorage`. El refresh token viaja solo como cookie `httpOnly`.

---

# Parte V — Sistema RTB y Automatización (n8n)

## 1. Lógica de negocio del ERP en Notion

Notion es el sistema de registro primario donde el equipo operativo captura toda la actividad del negocio. Está organizado en bases de datos relacionadas que cubren el ciclo completo:

**Catálogos maestros:**
- `Catálogo de Productos` — fuente de verdad de SKU y Código Interno
- `Directorio de Ubicaciones` — clientes y proveedores unificados (discriminado por campo `Tipo`)
- `Proveedores y Productos` — tabla puente producto-proveedor con precio por proveedor

**Flujo de Ventas:**
`Cotizaciones a Clientes` → `Detalles de Cotizaciones` (renglones) → `Pedidos de Clientes` → `Reporte de Ventas`
- Si hay faltantes: → `Pedidos Incompletos`
- Si se cancela: → `Cotizaciones Canceladas`

**Flujo de Compras:**
`Solicitudes de Material` → `Solicitudes A Proveedor (OC)` → `Entradas de Mercancía` + `FACTURAS COMPRAS` → `Gestión de Inventario`
- También: `Gastos Operativos RTB` (gastos no inventariables)

**Inventario y Calidad:**
- `Gestión de Inventario` — stock teórico vs real con rollups
- `Bitácora de Movimientos` — log consolidado de entradas y salidas
- `No Conformes` — ajustes de inventario (entrada/salida manual)

## 2. Flujo de datos: Notion → n8n → Supabase

```
Notion DB (actualización por operativos)
         │
         │ cada hora, filtrado por "última edición = hoy"
         ▼
n8n "Get many database pages" (nodo Notion)
         │
         ▼
n8n "Normalizador" (nodo Set)
  - Aplana propiedades nested (rollups, relaciones, fórmulas)
  - Renombra a campos estables (independientes de slugs Notion)
  - Tipado: string, number, boolean, array
  - Cálculos derivados:
      * costo_unitario = costo_total / cantidad_llegada
      * subtotal_oc = total - iva - envio
         │
         ▼
POST /api/sync/{entidad}  (Nexus Ops backend)
  Header: X-Sync-Key: {SYNC_API_KEY}
         │
         ▼
Staging tables → merge a tablas operativas → _recalc_inventario()
```

## 3. Catálogo de flujos (17 flujos versionados en JSON)

| Flujo | Entidad | Frecuencia |
|-------|---------|-----------|
| 01 | Catálogo de Productos | Bajo demanda + meta-flujo |
| 02 | Directorio de Ubicaciones (Clientes/Proveedores) | Bajo demanda + meta-flujo |
| 03 | Proveedores y Productos (precios) | Bajo demanda + meta-flujo |
| 04 | Cotizaciones a Clientes | Bajo demanda + meta-flujo |
| 05 | Detalles de Cotizaciones | Bajo demanda + meta-flujo |
| 06 | Pedidos de Clientes | Bajo demanda + meta-flujo |
| 07 | Reporte de Ventas | Bajo demanda + meta-flujo |
| 08 | Solicitudes de Material | Bajo demanda + meta-flujo |
| 09 | Solicitudes A Proveedor (OC) | Bajo demanda + meta-flujo |
| 10 | FACTURAS COMPRAS | Bajo demanda + meta-flujo |
| 11 | Entradas de Mercancía | Bajo demanda + meta-flujo |
| 12 | Gestión de Inventario | Bajo demanda + meta-flujo |
| 13 | Gastos Operativos RTB | Bajo demanda + meta-flujo |
| 14 | No Conformes / Bitácora | Bajo demanda + meta-flujo |
| **15** | **Meta-flujo** (lanza todos los anteriores) | **06:00 diario** |
| **16** | **Alertas operativas** | **Cada 15 min** |
| **17** | **Backup nocturno** | **03:00 diario** |

Los flujos 01-14 se pueden disparar individualmente o a través del meta-flujo. El backend puede disparar el flujo 15 vía `/api/sync/trigger`.

## 4. Seguridad de flujos

- Los webhooks de n8n que reciben datos del backend requieren `X-Sync-Key` en el header.
- n8n está protegido con autenticación básica (`N8N_BASIC_AUTH_USER` / `N8N_BASIC_AUTH_PASSWORD`).
- Los flujos JSON se versionan en git en `automations/n8n_flows/` (sin credenciales, solo estructura).
- Los datos de n8n (credenciales Notion, configuración de nodos) viven en `automations/n8n_data/` que **no está en git** (`.gitignore`).

---

# Parte VI — Seguridad

## 1. Modelo de acceso

**Producción:**
- El servidor EC2 no expone puertos directamente al internet público (solo SSH para mantenimiento)
- Cloudflare Tunnel (`cloudflared`) establece una conexión saliente segura desde el EC2 hacia Cloudflare
- El tráfico HTTPS llega a Cloudflare → tunel → nginx en el EC2
- Sin IP pública expuesta = sin ataques directos al puerto 80/443

**Desarrollo:**
- Opción A: ngrok tunnel (para webhooks externos)
- Opción B: Cloudflare Tunnel en dev (mismo mecanismo que prod)
- La red interna Docker es privada; solo nginx en el puerto 80 del host

## 2. JWT + Refresh Tokens + TOTP 2FA

Ver sección III.5 para el flujo completo. Resumen de la configuración:

```
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS   = 7
JWT_ALGORITHM               = HS256
cookie_secure               = True en producción (solo HTTPS)
cookie_samesite             = strict
cookie_path                 = /api/auth  (scope mínimo)
```

**Multi-sesión:** Cada dispositivo/browser tiene su propio `refresh_token` en la BD con metadatos: `device_name`, `ip_address`, `last_used_at`. Desde `/cuenta/sesiones` el usuario puede ver y revocar sesiones individuales.

**Backup codes TOTP:** Al activar 2FA se generan 8 backup codes de un solo uso. Si el usuario pierde el autenticador, puede usar un backup code para acceder y reconfigurar 2FA.

## 3. RBAC (7 roles)

El sistema de permisos usa granularidad a nivel de permiso individual (no solo rol). Cada endpoint que requiere autorización usa:

```python
# En el router
current_user: User = Depends(require_permission("ventas.create_quote"))
```

`require_permission()` consulta la cadena `user_roles → role_permissions → permissions` para verificar que el usuario tiene ese permiso específico.

Los 4 permisos base del módulo de clientes/proveedores (como ejemplo del patrón):

| Permiso | Descripción |
|---------|-------------|
| `clientes.view` | Ver lista y detalle de clientes |
| `clientes.create` | Crear nuevos clientes |
| `clientes.edit` | Editar clientes existentes |
| `clientes.delete` | Eliminar clientes |

## 4. Audit log

La tabla `audit_log` registra automáticamente (vía trigger) todas las operaciones DML en tablas críticas. Los campos almacenados:

```sql
audit_log (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  table_name  TEXT,
  record_id   TEXT,
  operation   TEXT,  -- INSERT | UPDATE | DELETE
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
)
```

El panel `/admin/audit-log` permite filtrar por usuario, tabla, operación y rango de fechas.

---

# Parte VII — Despliegue

## 1. Entornos: Desarrollo vs Producción

| Aspecto | Desarrollo | Producción (EC2) |
|---------|-----------|------------------|
| OS | Windows 11 + WSL2 / Linux | Amazon Linux 2023 |
| Arranque | `./scripts/init-project.sh` | Automático vía CodeDeploy pipeline |
| BD app | Supabase vía relay TCP WSL2 | Supabase URL directa |
| Backend cmd | `uvicorn --reload` (1 worker, hot-reload) | `uvicorn --workers 4` (4 workers, sin reload) |
| Frontend | Vite dev server interno + nginx en contenedor | Vite build estático servido por nginx |
| Tunnel | ngrok / Cloudflare | Cloudflare Tunnel (cloudflared) |
| n8n | Incluido en stack | Instancia separada (no en EC2 app) |
| `ENV` | `development` | `production` |
| Logs | Stdout Docker + loguru | Docker logs + loguru |

## 2. Variables de entorno críticas y por qué difieren entre entornos

```bash
# ── Base de Datos ──────────────────────────────────────────────────
# En desarrollo: Docker no puede resolver el hostname Supabase desde WSL2.
# Se usa un relay TCP local que escucha en host.docker.internal.
DATABASE_URL=postgresql+psycopg://user:pass@db.supabase.co:5432/postgres
DATABASE_URL_DOCKER=postgresql+psycopg://user:pass@host.docker.internal:5433/postgres
# En producción: solo DATABASE_URL (sin relay). docker-compose.prod.yml
# sobreescribe el ENV del servicio backend con DATABASE_URL directa.

# ── Frontend ───────────────────────────────────────────────────────
# En desarrollo: el browser hace fetch a localhost:8000 directamente.
VITE_API_URL=http://localhost:8000
# En producción: VITE_API_URL DEBE estar vacío.
# La variable se hornea en el bundle en build-time (Vite).
# Si se pone http://localhost:8000, el browser bloquea la petición porque
# localhost es loopback y el origen es la IP pública del usuario.
# Con vacío, los paths son relativos (/api/...) y nginx los proxea al backend.
VITE_API_URL=

# ── JWT ─────────────────────────────────────────────────────────────
JWT_SECRET=string-largo-aleatorio-diferente-en-cada-entorno

# ── Redis ─────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379  # nombre del servicio Docker, igual en ambos entornos

# ── n8n (solo en desarrollo) ───────────────────────────────────────
N8N_DB_NAME=n8n_db
N8N_POSTGRES_USER=n8n
N8N_POSTGRES_PASSWORD=...
N8N_USER=admin
N8N_PASSWORD=...
N8N_BASE_URL=http://n8n:5678
N8N_WEBHOOK_TOKEN=...
SYNC_API_KEY=...

# ── Email (MailerSend) ─────────────────────────────────────────────
MAILERSEND_API_TOKEN=...
FRONTEND_URL=https://tudominio.com  # para links en emails de reset password

# ── CORS ──────────────────────────────────────────────────────────
# En desarrollo: se deja vacío (el settings.py usa defaults localhost)
ALLOWED_ORIGINS=
# En producción: dominio real de Cloudflare
ALLOWED_ORIGINS=https://tudominio.com
```

## 3. Pipeline CI/CD (AWS CodePipeline → CodeBuild → CodeDeploy → EC2)

### Diagrama del pipeline

```
Developer push a main (GitHub)
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  AWS CodePipeline                                               │
│                                                                 │
│  ┌──────────┐    ┌───────────────┐    ┌─────────────────────┐  │
│  │  Source  │───▶│  Build        │───▶│  Deploy             │  │
│  │ (GitHub) │    │ (CodeBuild)   │    │ (CodeDeploy → EC2)  │  │
│  │          │    │               │    │                     │  │
│  │ main     │    │ nodejs:20     │    │ BeforeInstall       │  │
│  │          │    │ npm ci        │    │ Install (files)     │  │
│  │          │    │ lint          │    │ AfterInstall        │  │
│  │          │    │ typecheck     │    │ ApplicationStart    │  │
│  │          │    │ tar + zip     │    │ ValidateService     │  │
│  └──────────┘    └───────────────┘    └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
EC2: /home/ec2-user/nexus-ops-rtb
docker compose -f docker-compose.yml -f docker-compose.prod.yml up
```

### buildspec.yml explicado

El archivo `buildspec.yml` en la raíz del repositorio es ejecutado por AWS CodeBuild. Corre en un contenedor Amazon Linux con Node.js 20.

**Fase install:**
```yaml
- npm --prefix frontend ci --no-audit --no-fund
```
Instala dependencias del frontend. Se usa `--prefix frontend` porque `cd frontend` no persiste entre fases de CodeBuild (cada fase abre un shell nuevo).

**Fase pre_build:**
```yaml
- npm --prefix frontend run lint
- npm --prefix frontend run typecheck
```
Valida el código. Si hay errores ESLint o TypeScript, el pipeline falla aquí y el deploy no llega al EC2.

**Fase build:**
```yaml
- tar -czf /tmp/deploy.tgz --exclude='*/node_modules' --exclude='.env' ...
- tar -xzf /tmp/deploy.tgz -C deploy
```
El tarball se crea en `/tmp` para evitar el error "file changed as we read it" (tar no puede archivarse a sí mismo). El `.env` se excluye explícitamente — nunca viaja en el artefacto.

**Artefacto:** El directorio `deploy/` se sube a S3. CodeDeploy lo descarga y lo copia al EC2.

**Cache:** `frontend/node_modules` y `/root/.npm` se cachean entre builds para acelerar `npm ci`.

### appspec.yml explicado

El archivo `appspec.yml` en la raíz define el comportamiento de CodeDeploy.

```yaml
files:
  - source: /
    destination: /home/ec2-user/nexus-ops-rtb
```
Copia todo el artefacto a `/home/ec2-user/nexus-ops-rtb` en el EC2.

Los hooks `os` y `permissions` no son soportados por el deploy action de CodePipeline EC2 y se omiten.

### Hooks y qué hace cada uno

**`before_install.sh`** — Corre ANTES de copiar archivos:
- Exporta PATH con `/usr/local/bin` para encontrar Docker
- Si hay deployment previo: detiene `backend`, `frontend`, `proxy`
- No toca Redis ni n8n (servicios persistentes)
- No toca Supabase (BD externa)

**`after_install.sh`** — Corre DESPUÉS de copiar archivos:
- Copia `/home/ec2-user/.nexus-ops-rtb.env` → `APP_DIR/.env` (el .env vive fuera del directorio de deploy en el servidor)
- Crea directorios de datos: `data/backups`, `data/logs`, `data/csv`, `data/reports`
- `chown -R ec2-user:ec2-user` sobre todo el directorio
- `chmod 755` en todos los scripts `.sh`

**`application_start.sh`** — Construye y levanta el stack:
1. `docker compose build backend frontend` — construye imágenes (Vite hornea VITE_API_URL en este paso)
2. `docker compose up -d redis`
3. `docker compose up -d backend` — espera hasta estado `healthy` (máx 90s)
4. `docker compose exec -T backend alembic upgrade head` — aplica migraciones pendientes
5. `docker compose up -d frontend proxy cloudflared`
6. `nginx -s reload` para refrescar upstreams

**`validate_service.sh`** — Verifica que el deploy fue exitoso:
- Verifica estado `running` de: `redis`, `backend`, `frontend`, `proxy`
- `GET http://localhost:8000/health` → espera 200
- `GET http://localhost/` → espera 200/301/302
- Si algún check falla: `exit 1` → CodeDeploy marca deployment como fallido

## 4. Setup inicial del EC2 (operación única)

```bash
# 1. Instalar Docker
sudo dnf update -y
sudo dnf install docker -y
sudo systemctl start docker && sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# 2. Instalar Docker Buildx v0.20.0+
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -L \
  https://github.com/docker/buildx/releases/download/v0.20.0/buildx-v0.20.0.linux-amd64 \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx

# 3. Instalar Docker Compose v2
COMPOSE_V=$(curl -s https://api.github.com/repos/docker/compose/releases/latest \
  | grep '"tag_name"' | cut -d'"' -f4)
sudo curl -L \
  "https://github.com/docker/compose/releases/download/${COMPOSE_V}/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Verificar instalaciones
docker --version && docker compose version && docker buildx version

# 4. Crear el .env de producción (fuera del directorio de deploy)
sudo nano /home/ec2-user/.nexus-ops-rtb.env
# Pegar el .env completo de producción
sudo chmod 600 /home/ec2-user/.nexus-ops-rtb.env

# 5. Crear directorio destino
mkdir -p /home/ec2-user/nexus-ops-rtb

# 6. Verificar SSM Agent (necesario para CodeDeploy vía CodePipeline)
sudo systemctl status amazon-ssm-agent
# Si no está corriendo:
sudo systemctl start amazon-ssm-agent && sudo systemctl enable amazon-ssm-agent
```

**IAM Role `EC2Role-SSM-Nexus-RTB` necesita:**
```json
{
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:GetObjectVersion", "s3:ListBucket"],
    "Resource": "arn:aws:s3:::codepipeline-us-east-1-4cdf5acc9f0c-4c57-8831-35008eb5f4ae/*"
  }]
}
```

## 5. Operaciones manuales en producción

```bash
# Comando base (todos los comandos manuales en EC2 usan esta forma)
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
cd /home/ec2-user/nexus-ops-rtb

# Ver estado de contenedores
$COMPOSE ps

# Ver logs en tiempo real
$COMPOSE logs -f backend
$COMPOSE logs -f frontend

# Aplicar migraciones sin pasar por el pipeline
$COMPOSE exec backend alembic upgrade head

# Reconstruir solo el frontend (ej.: cambio en VITE_API_URL)
$COMPOSE build --no-cache frontend
$COMPOSE up -d frontend

# Reconstruir y reiniciar el backend
$COMPOSE build backend
$COMPOSE up -d backend

# Health check completo
curl -s http://localhost:8000/health
curl -s -o /dev/null -w "%{http_code}" http://localhost/

# Rollback manual a un deployment anterior (vía AWS CLI)
aws deploy create-deployment \
  --application-name nexus-ops-rtb \
  --deployment-group-name production \
  --deployment-config-name CodeDeployDefault.OneAtATime \
  --s3-location bucket=BUCKET,key=ARTIFACT_KEY,bundleType=zip
```

## 6. Troubleshooting del pipeline (errores reales resueltos)

### Error: `cd frontend: No such file or directory` en CodeBuild
**Causa:** `cd frontend` no persiste entre fases. Cada fase de CodeBuild abre un shell nuevo desde la raíz del repositorio.
**Fix:** Usar `npm --prefix frontend <comando>` en lugar de `cd frontend && npm`.

### Error: `tar: file changed as we read it`
**Causa:** Al ejecutar `tar -czf deploy.tgz .`, tar archivaba el directorio actual y encontraba el propio `deploy.tgz` mientras lo creaba.
**Fix:** Crear el tarball en `/tmp`: `tar -czf /tmp/deploy.tgz ...`

### Error: `docker: command not found` en hooks CodeDeploy
**Causa:** Los scripts corren como `root` vía SSM con un PATH mínimo que no incluye `/usr/local/bin` donde está Docker.
**Fix:** Cada script de hook tiene en la primera línea: `export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"`

### Error: `compose build requires buildx 0.17.0 or later`
**Causa:** Versión antigua de Docker Buildx en EC2.
**Fix:**
```bash
sudo curl -L https://github.com/docker/buildx/releases/download/v0.20.0/buildx-v0.20.0.linux-amd64 \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
```

### Error: `Name or service not known` en alembic migrate (EC2)
**Causa:** El backend usaba `DATABASE_URL_DOCKER` (relay WSL2) que no existe en EC2.
**Fix:** `docker-compose.prod.yml` sobreescribe el env del servicio backend con `DATABASE_URL: ${DATABASE_URL}` (URL directa a Supabase).

### Error: `Access to fetch at 'http://localhost:8000'` bloqueado en prod
**Causa:** `VITE_API_URL=http://localhost:8000` estaba horneado en el bundle del frontend.
**Fix:**
```bash
# En el servidor:
sed -i 's|^VITE_API_URL=.*|VITE_API_URL=|' /home/ec2-user/nexus-ops-rtb/.env
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d frontend
```

### Error: `S3 AccessDenied` al descargar artefacto en EC2
**Causa:** El IAM Role del EC2 no tenía `s3:GetObject` sobre el bucket de CodePipeline.
**Fix:** Agregar política inline `CodePipelineArtifactRead` al role `EC2Role-SSM-Nexus-RTB` con el ARN completo del bucket de artefactos.

### Error: appspec warnings sobre claves `os` y `permissions`
**Causa:** Estas claves son opcionales y no soportadas por el deploy action EC2 de CodePipeline.
**Fix:** Simplemente omitirlas del `appspec.yml`. Solo se necesita `version`, `files` y `hooks`.

---

# Parte VIII — Operación y Mantenimiento

## 1. Scripts disponibles

| Script | Uso | Propósito |
|--------|-----|-----------|
| `./scripts/init-project.sh` | Dev (bash/Git Bash) | Arranque completo: relay + docker compose + migraciones |
| `.\scripts\init-dev.ps1` | Dev (PowerShell) | Ídem, implementación PowerShell |
| `.\scripts\init-dev.ps1 -SkipRelay` | Dev | Si el relay ya corre en otra terminal |
| `.\scripts\init-dev.ps1 -WithNgrok` | Dev | Incluye ngrok (requiere NGROK_AUTHTOKEN) |
| `.\scripts\init-dev.ps1 -SkipN8n` | Dev ligero | Omite n8n y postgres-n8n |
| `./scripts/stop.sh` | Dev | Detener stack preservando volúmenes |
| `./scripts/setup-db.sh` | Dev / Recuperación | Migraciones + triggers + CSVs + usuario admin desde cero |
| `./scripts/backup-db.sh` | Dev / Prod manual | Backup comprimido en `data/backups/` |
| `./scripts/restore-db.sh` | Dev / Recuperación | Restaurar backup (sin arg: usa el más reciente) |
| `./scripts/update-safe.sh` | Prod manual | pull + backup + build + migrate (flujo seguro sin pipeline) |
| `./scripts/health-check.sh` | Cualquier entorno | Verifica estado de todos los servicios |

## 2. Comandos frecuentes

### Desarrollo

```bash
# Iniciar el proyecto
bash ./scripts/init-project.sh
# o en PowerShell:
.\scripts\init-dev.ps1

# Detener
bash ./scripts/stop.sh

# Solo reconstruir app (sin tocar BD ni volúmenes)
docker compose up -d --build backend frontend

# Aplicar migraciones pendientes
docker compose exec backend alembic upgrade head

# Crear nueva migración
docker compose exec backend alembic revision --autogenerate -m "descripcion_corta"

# Ver logs
docker compose logs -f backend
docker compose logs -f frontend

# Acceder al backend directamente
docker compose exec backend bash

# Correr tests
docker compose exec backend pytest
```

### Producción (en EC2)

```bash
# Los comandos de producción siempre usan el stack combinado:
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

# Estado del stack
$COMPOSE ps

# Logs
$COMPOSE logs -f --tail=100 backend

# Migraciones manuales
$COMPOSE exec backend alembic upgrade head

# Reiniciar servicio individual
$COMPOSE restart backend

# Rebuild sin pipeline
$COMPOSE build backend && $COMPOSE up -d backend
```

## 3. Monitoreo y healthchecks

### Endpoint de salud del backend

```
GET /health
→ 200 OK
{"status": "ok", "db": "connected", "redis": "connected"}
```

### Healthchecks Docker Compose

Los servicios `redis` y `postgres-n8n` tienen healthchecks configurados. El servicio `backend` depende de `redis: condition: service_healthy`.

### Script de verificación completo

```bash
bash ./scripts/health-check.sh
# Verifica: contenedores running, /health endpoint, nginx :80
```

### Verificación manual en producción

```bash
# Verificar que todos los contenedores están running
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Health del backend
curl http://localhost:8000/health

# Nginx respondiendo
curl -s -o /dev/null -w "%{http_code}" http://localhost/

# Revisar uso de recursos
docker stats --no-stream
```

## 4. Backup y restauración

### Backup manual

```bash
bash ./scripts/backup-db.sh
# Genera: data/backups/backup_YYYY-MM-DD_HH-MM-SS.sql.gz
```

### Backup automático

El flujo n8n 17 ejecuta un backup a las 03:00 todos los días.

### Restaurar desde backup

```bash
# Restaurar el backup más reciente
bash ./scripts/restore-db.sh

# Restaurar backup específico
bash ./scripts/restore-db.sh data/backups/backup_2026-05-01_03-00-00.sql.gz
```

### Consideración crítica

La BD está en Supabase. Los scripts de backup/restore usan `pg_dump` / `psql` contra el host de Supabase directamente. Asegurarse de que `DATABASE_URL` esté correctamente configurada antes de ejecutarlos.

**Comandos destructivos que requieren confirmación explícita antes de ejecutar:**
- `docker compose down -v` — destruye volúmenes Docker (afecta redis y n8n, no la BD app)
- `DROP SCHEMA public CASCADE` en Supabase — destruye toda la BD
- `bash ./scripts/restore-db.sh` sobre producción — sobreescribe datos en vivo

---

# Apéndice — Decisiones Técnicas Clave

Esta sección documenta las 10 decisiones de diseño más importantes del sistema y la razón de cada una.

## 1. Supabase como BD (sin contenedor postgres local para la app)

**Decisión:** La BD de la aplicación vive en Supabase, no en un contenedor Docker local.

**Razón:** Elimina la operación del motor PostgreSQL (backups, upgrades, volúmenes). Supabase provee backups automáticos, dashboard de métricas y acceso desde cualquier entorno sin tuneles de BD. El `docker compose down -v` no puede destruir la BD accidentalmente.

**Tradeoff:** En desarrollo con WSL2 hay latencia de red adicional y se necesita el relay TCP (`DATABASE_URL_DOCKER`). En producción (EC2 con IP pública en la misma región AWS) la latencia es mínima.

## 2. DATABASE_URL_DOCKER (relay para WSL2)

**Decisión:** Dos variables de BD — `DATABASE_URL` (directa a Supabase) y `DATABASE_URL_DOCKER` (relay local para Docker en WSL2).

**Razón:** Docker Desktop sobre Windows corre los contenedores dentro de una VM Linux (WSL2). Desde esa VM, el hostname de Supabase puede no resolverse correctamente dependiendo del DNS configurado. El relay es un proceso en el host Windows que hace de puente TCP.

**Producción:** Solo existe `DATABASE_URL`. `docker-compose.prod.yml` sobreescribe el ENV del backend con `DATABASE_URL: ${DATABASE_URL}`.

## 3. VITE_API_URL vacío en producción

**Decisión:** En el `.env` de producción, `VITE_API_URL` debe estar vacío (no una URL).

**Razón:** Vite hornea el valor de `import.meta.env.VITE_API_URL` en el bundle JavaScript en tiempo de build. Si se pone `http://localhost:8000`, ese valor queda literal en el código JavaScript que el browser del usuario descarga. El browser bloquea la petición porque `localhost` es un loopback address y el origen de la página es una IP pública (violación de seguridad del browser).

Con `VITE_API_URL=` (vacío), las llamadas son paths relativos (`/api/...`) que nginx resuelve localmente desde el mismo servidor.

## 4. psycopg3 requiere CAST explícito

**Decisión:** Toda consulta SQL con parámetros tipados usa `CAST(:param AS tipo)`, nunca `::tipo`.

**Razón:** psycopg3 analiza las consultas antes de enviarlas al servidor y no reconoce la sintaxis de cast de PostgreSQL (`::`). Genera un error de parse. `CAST()` es SQL estándar y psycopg3 lo entiende. Especialmente importante para parámetros que pueden ser NULL — psycopg3 no puede inferir el tipo de un parámetro None sin un CAST explícito.

## 5. SQLAlchemy async — commit explícito y eager-load

**Decisión:** Siempre `await db.commit()` explícito. Siempre `selectinload()` / `joinedload()` para relaciones antes de salir del contexto de sesión.

**Razón:** SQLAlchemy 2.x async no tiene autocommit por defecto. Sin commit explícito, los cambios se revierten al cerrar la sesión. Las relaciones lazy (acceso a `model.relacion` fuera del contexto async) lanzan `MissingGreenlet` — el ORM intenta hacer una query síncrona desde un contexto async y falla.

## 6. react-hooks v7 — override manual en ESLint

**Decisión:** No usar las reglas nuevas de `eslint-plugin-react-hooks` v7 (`set-state-in-effect`, `static-components`).

**Razón:** La v7 introdujo reglas que generan falsos positivos masivos con el patrón `useEffect(() => { fetch(..., { signal }) })` que es el estándar de fetching del proyecto. En lugar de refactorizar todos los componentes o agregar `// eslint-disable` en todos lados, se hace override en `eslint.config.js` manteniendo solo `rules-of-hooks: error` y `exhaustive-deps: warn`.

## 7. DataTable API — cell/rows/rowKey/emptyLabel

**Decisión:** El componente DataTable tiene una API fija. No se usan props de otras convenciones.

**Razón:** Evitar inconsistencias entre páginas. El prop `cell` en lugar de `render`, `rows` en lugar de `data`, `rowKey` como función. El `fetcher` recibe un `AbortSignal` directamente (no devuelve una promesa de cleanup) — esto encaja con el patrón `useEffect + AbortController` del proyecto.

## 8. AppShell con h-screen en main

**Decisión:** El contenedor `main` del AppShell usa `h-screen` (altura fija de viewport), no `min-h-screen`.

**Razón:** Con `min-h-screen`, el main crece con el contenido y el scroll ocurre en el body, lo que hace que el sidebar también scrollee. Con `h-screen`, el main tiene altura fija y el scroll interno queda contenido en el área de contenido, manteniendo el sidebar y header fijos. Es obligatorio para páginas master-detail (sidebar izquierdo con lista + panel derecho con detalle).

## 9. Alembic create_all — nunca sin filtro de tablas

**Decisión:** Nunca usar `Base.metadata.create_all(bind=conn)` dentro de una migración Alembic sin filtrar las tablas.

**Razón:** `create_all()` sin filtro crea todas las tablas definidas en los modelos ORM en el momento de correr la migración. Si hay modelos de migraciones futuras ya definidos en el código, `create_all()` los crea en BD antes de que su migración oficial corra. Esto hace que la migración oficial falle con "tabla ya existe" y corrompe el estado de Alembic. Si se necesita `create_all()`, siempre usar `tables=[tabla_especifica]`.

## 10. CORS en respuestas de error 500

**Decisión:** El middleware CORS se registra antes del exception handler global. El exception handler devuelve `JSONResponse` (no relanza la excepción).

**Razón:** Starlette (base de FastAPI) aplica middlewares de afuera hacia adentro para requests y de adentro hacia afuera para responses. Si el exception handler relanzara la excepción o devolviera una respuesta antes de que el middleware CORS la procese, el browser del frontend recibiría un 500 sin headers `Access-Control-Allow-Origin` y bloquearía la respuesta, mostrando un error de CORS en lugar del error real del servidor.

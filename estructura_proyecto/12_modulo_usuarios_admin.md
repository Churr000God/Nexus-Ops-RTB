# Módulo de Gestión de Usuarios y Roles — Panel de Administración

**Ruta frontend:** `/admin/usuarios` · `/admin/roles`
**Prefijo backend:** `/api/usuarios` · `/api/admin`

---

## 1. Visión general

El módulo cubre todo el ciclo de vida de usuarios internos del sistema: alta, edición, activación/desactivación, cambio de contraseña y asignación de permisos de acceso. Está dividido en dos pestañas del panel de administración:

| Pestaña | Ruta | Qué gestiona |
|---------|------|--------------|
| Usuarios | `/admin/usuarios` | CRUD de usuarios, toggle de estado, cambio de contraseña |
| Roles y Permisos | `/admin/roles` | Catálogo de roles RBAC, sus permisos, creación de nuevos roles |

---

## 2. Modelo de base de datos

### 2.1 Tablas involucradas

```
users
├── id              UUID PK
├── email           VARCHAR(255) UNIQUE
├── hashed_password VARCHAR(255)
├── full_name       TEXT
├── role            VARCHAR(20)   ← campo legacy (admin | operativo | lectura)
├── is_active       BOOLEAN
├── last_login_at   TIMESTAMPTZ
├── created_at      TIMESTAMPTZ
└── updated_at      TIMESTAMPTZ

roles
├── role_id         SMALLINT IDENTITY PK
├── code            TEXT UNIQUE     ← ej. ADMIN, SALES, WAREHOUSE
├── name            TEXT
└── description     TEXT

permissions
├── permission_id   SMALLINT IDENTITY PK
├── code            TEXT UNIQUE     ← ej. user.manage, quote.create
└── description     TEXT

role_permissions  (tabla pivote)
├── role_id         FK → roles.role_id
└── permission_id   FK → permissions.permission_id

user_roles  (tabla pivote)
├── user_id         FK → users.id
├── role_id         FK → roles.role_id
└── granted_at      TIMESTAMPTZ

refresh_tokens
├── id              UUID PK
├── user_id         FK → users.id (CASCADE)
├── token_hash      VARCHAR(255)
└── expires_at      TIMESTAMPTZ

audit_log
├── audit_id        BIGINT IDENTITY PK
├── user_id         FK → users.id (nullable)
├── entity_type     TEXT
├── entity_id       TEXT
├── action          TEXT  (INSERT | UPDATE | DELETE)
├── before_data     JSONB
├── after_data      JSONB
└── changed_at      TIMESTAMPTZ
```

### 2.2 Relaciones clave

```
users ──< user_roles >── roles ──< role_permissions >── permissions
  │
  └──< refresh_tokens
```

- Un usuario puede tener **múltiples roles RBAC** (`user_roles`).
- Un rol tiene **múltiples permisos** (`role_permissions`).
- Los permisos son atómicos y se crean únicamente cuando se implementa nueva funcionalidad (no hay UI de creación de permisos).

---

## 3. Sistema dual de roles

El sistema tiene **dos capas de rol en paralelo**, herencia de la transición al RBAC completo:

### Capa 1 — `users.role` (campo legacy)

| Valor | Propósito |
|-------|-----------|
| `admin` | Permite cambiar contraseñas de otros usuarios, acceder al panel de administración |
| `operativo` | Uso operacional estándar |
| `lectura` | Solo consulta |

- Almacenado directamente en la fila del usuario.
- Se usa en los guards de backend (`require_roles("admin")`).
- Se selecciona al crear el usuario (campo en el formulario de alta).

### Capa 2 — `roles` RBAC

- Roles definidos en la tabla `roles`: `ADMIN`, `SALES`, `PURCHASING`, `WAREHOUSE`, `ACCOUNTING`, `READ_ONLY`, `DRIVER` (y los que se creen).
- Se asignan vía `user_roles`.
- Los permisos atómicos de cada rol se cargan en el JWT al hacer login.
- Son los que controlan el acceso real a cada endpoint y funcionalidad.

**Regla:** el campo `users.role` controla quién puede hacer gestión administrativa de usuarios. Los permisos RBAC (`users.permissions` en el JWT) controlan el acceso a cada operación del negocio.

---

## 4. Flujo completo de alta de usuario

### Paso 1 — Crear el registro

**Endpoint:** `POST /api/usuarios`
**Permiso requerido:** `user.manage`

```json
{
  "email": "usuario@empresa.com",
  "full_name": "Nombre Apellido",
  "password": "ContraseñaSegura1",
  "role": "operativo"
}
```

Validaciones aplicadas:
- `email`: formato válido, normalizado a lowercase.
- `password`: mínimo 10 caracteres, máximo 72 bytes UTF-8, debe contener al menos 1 letra y 1 número.
- `role`: solo acepta `admin`, `operativo`, `lectura`.

El backend hace hash de la contraseña con **bcrypt rounds=12** antes de persistir.

### Paso 2 — Asignar roles RBAC

**Endpoint:** `POST /api/usuarios/{user_id}/roles`
**Permiso requerido:** `role.manage`

```json
{ "role_code": "SALES" }
```

Operación idempotente — no falla si el rol ya estaba asignado. Sin este paso el usuario puede autenticarse pero no tendrá permisos operacionales en el JWT.

### Paso 3 — El usuario inicia sesión

`POST /api/auth/login` → JWT con `permissions[]` calculado vía 4 JOINs:
```
users → user_roles → roles → role_permissions → permissions
```

---

## 5. Edición de usuarios

**Endpoint:** `PATCH /api/usuarios/{user_id}`
**Permiso requerido:** `user.manage`

Campos editables:
```json
{
  "full_name": "Nuevo Nombre",
  "is_active": false
}
```

Desactivar un usuario (`is_active: false`) impide el login: `authenticate_user` verifica este flag antes de emitir tokens.

---

## 6. Cambio de contraseña

**Endpoint:** `PATCH /api/usuarios/{user_id}/password`
**Permiso requerido:** `user.manage`

Reglas de negocio aplicadas **en el backend** (no solo en el frontend):

1. El `current_user` (quien ejecuta la operación) debe tener `users.role == "admin"`.
2. El usuario objetivo (`target`) no puede tener `users.role == "admin"`.

```json
{ "new_password": "NuevaContraseña1" }
```

Si alguna regla falla → HTTP 403 con mensaje explicativo.

En el frontend, la sección de cambio de contraseña solo se **renderiza** si:
- `currentUser.role === "admin"` (campo legacy del store)
- `targetUser.role !== "admin"`

Esto es una protección UX adicional; la regla real reside en el backend.

---

## 7. Gestión de roles RBAC

### Listar roles con permisos

**Endpoint:** `GET /api/admin/roles`
**Permiso requerido:** `role.manage`

Devuelve `RoleWithPermissions[]` — cada rol incluye el array completo de sus permisos.

### Crear nuevo rol

**Endpoint:** `POST /api/admin/roles`
**Permiso requerido:** `role.manage`

```json
{
  "code": "VENTAS_SR",
  "name": "Ventas Senior",
  "description": "Rol con acceso a cotizaciones y contratos de precio",
  "permission_codes": ["quote.view", "quote.create", "customer_contract_price.manage"]
}
```

- El `code` se normaliza a **mayúsculas** y solo acepta letras, números y guiones bajos.
- Si el código ya existe → HTTP 409 Conflict.
- Si algún `permission_code` no existe en la tabla `permissions` → HTTP 422.

### Asignar / revocar roles a usuarios

```
POST   /api/usuarios/{user_id}/roles          body: { role_code }
DELETE /api/usuarios/{user_id}/roles/{code}
```

Ambos idempotentes.

---

## 8. Catálogo de permisos

Los permisos se crean **únicamente al implementar nueva funcionalidad**, mediante migraciones Alembic. No existe endpoint ni UI de creación de permisos.

Actualmente hay **70 permisos únicos** agrupados por módulo:

| Módulo | Prefijo | Ejemplos |
|--------|---------|---------|
| Usuarios | `user.*` | `user.view`, `user.manage` |
| Roles | `role.*` | `role.manage` |
| Clientes | `customer.*` | `customer.view`, `customer.manage` |
| Proveedores | `supplier.*` | `supplier.view`, `supplier.manage` |
| Productos | `product.*` | `product.view`, `product.manage`, `product.price.manage` |
| Cotizaciones | `quote.*` | `quote.view`, `quote.create`, `quote.approve`, `quote.cancel` |
| Pedidos | `order.*` | `order.view`, `order.pack`, `order.ship`, `order.deliver` |
| Logística | `delivery_note.*`, `shipment.*`, `route.*` | — |
| Compras | `compras.*`, `purchase_request.*`, `purchase_order.*`, `goods_receipt.*` | — |
| Facturación | `cfdi.*` | `cfdi.issue`, `cfdi.cancel`, `cfdi.config.manage` |
| Reportes | `report.*` | `report.sales`, `report.financial` |
| Auditoría | `audit.*` | `audit.view` |

El listado completo con descripciones está disponible en `GET /api/admin/permissions`.

---

## 9. Pantallas del panel de administración

### `/admin/usuarios`

```
┌─ Toolbar ──────────────────────────────┐
│ "N usuarios"          [+ Nuevo usuario]│
└────────────────────────────────────────┘
┌─ Tabla ────────────────────────────────────────────────────────┐
│ Email │ Nombre │ Roles RBAC │ Estado │ Último acceso │ Acciones│
│  ...  │  ...   │  [SALES]   │ Activo │  2026-04-29   │[Editar][Roles]│
└────────────────────────────────────────────────────────────────┘
```

**Modal "Nuevo usuario"** — campos: email, nombre, contraseña + confirmación, rol legacy (select).

**Modal "Editar"** — campos: nombre, toggle activo/inactivo. Si el viewer es `admin` y el target no lo es, aparece sección colapsable "Cambiar contraseña".

**Modal "Roles"** — lista de roles activos con botón revocar y lista de roles disponibles con botón asignar.

### `/admin/roles`

```
┌─ Sección Roles ──────────────────────────────┐
│ "N roles configurados"        [+ Nuevo rol]  │
│                                               │
│ ▶ [ADMIN]  Administrador     64 permisos     │
│ ▶ [SALES]  Ventas            21 permisos     │
│ ▼ [WAREHOUSE] Almacén        20 permisos     │
│   inventory.adjust  inventory.view  ...      │
└───────────────────────────────────────────────┘

┌─ Sección Permisos del sistema ───────────────┐
│ [🔍 Buscar por código o descripción…]        │
│                                               │
│ USUARIOS          PRODUCTOS        VENTAS     │
│ user.view         product.view     quote.view │
│ user.manage       product.manage   quote.create│
│ ...               ...              ...        │
└───────────────────────────────────────────────┘
```

**Modal "Nuevo rol"** — código (auto-mayúsculas), nombre, descripción opcional, lista de permisos agrupados por módulo con checkboxes y buscador interno.

---

## 10. Guards de seguridad

| Acción | Permiso RBAC requerido | Regla adicional |
|--------|----------------------|-----------------|
| Ver lista de usuarios | `user.view` | — |
| Crear / editar usuario | `user.manage` | — |
| Cambiar contraseña de usuario | `user.manage` | `current.role == "admin"` y `target.role != "admin"` |
| Asignar / revocar roles | `role.manage` | — |
| Ver / crear roles | `role.manage` | — |
| Ver catálogo de permisos | `role.manage` | — |

Los guards se aplican en **dos niveles**:
1. **Backend:** `Depends(require_permission("..."))` en cada endpoint.
2. **Frontend:** `usePermission("...")` para mostrar/ocultar botones y secciones (protección UX, no de seguridad).

---

## 11. Archivos relevantes

### Backend
| Archivo | Responsabilidad |
|---------|----------------|
| `app/models/user_model.py` | ORM: `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `RefreshToken`, `AuditLog` |
| `app/schemas/auth_schema.py` | `RegisterRequest`, `LoginRequest`, `UserResponse` |
| `app/schemas/user_schema.py` | `UserUpdateSchema`, `ChangePasswordRequest`, `CreateRoleRequest`, `AssignRoleRequest` |
| `app/services/auth_service.py` | Login, register, hash/verify password, JWT, refresh tokens |
| `app/services/user_service.py` | CRUD de usuarios, asignación de roles, cambio de contraseña |
| `app/services/admin_service.py` | Listado de roles con permisos, creación de roles, audit log |
| `app/routers/auth.py` | `/api/auth/*` |
| `app/routers/usuarios.py` | `/api/usuarios/*` |
| `app/routers/admin.py` | `/api/admin/roles`, `/api/admin/permissions`, `/api/admin/audit-log` |
| `app/dependencies.py` | `get_current_user`, `require_permission`, `require_roles` |

### Frontend
| Archivo | Responsabilidad |
|---------|----------------|
| `src/pages/AdminUsuarios.tsx` | Página completa: listado, modales de alta/edición/roles/contraseña |
| `src/pages/admin/RolesPage.tsx` | Página completa: cards de roles, catálogo de permisos con búsqueda, modal de nuevo rol |
| `src/services/adminService.ts` | `listUsers`, `createUser`, `updateUser`, `changePassword`, `listRoles`, `createRole`, `listPermissions`, `assignRole`, `revokeRole` |
| `src/stores/authStore.ts` | Estado de sesión: `user` (con `role`, `permissions`, `roles`), `accessToken` |
| `src/hooks/usePermission.ts` | `usePermission(code)` — reactivo al store |
| `src/types/auth.ts` | Tipo `User` (incluye `role`, `roles[]`, `permissions[]`) |
| `src/types/admin.ts` | Tipos `Role`, `Permission`, `AuditLogEntry` |

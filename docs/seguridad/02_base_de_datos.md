# Base de Datos — Módulo de Seguridad

Todas las tablas viven en Supabase (PostgreSQL 15). La migración inicial del módulo de seguridad es `20260428_0010`.

---

## Diagrama de relaciones

```
users (1) ──────────────── (N) refresh_tokens
  │                              ↳ user_id FK → users.id CASCADE
  │
  ├──── (1) ──────────────── (N) password_reset_tokens
  │                              ↳ user_id FK → users.id CASCADE
  │
  ├──── (1) ──────────────── (N) totp_backup_codes
  │                              ↳ user_id FK → users.id CASCADE
  │
  ├──── (N:N via user_roles) ─── roles
  │       user_id FK + role_id FK (PK compuesta)
  │
  └──── (1) ──────────────── (N) audit_log (nullable)
                                  ↳ user_id FK → users.id (nullable)

roles (1) ─── (N:N via role_permissions) ─── permissions
                role_id FK + permission_id FK (PK compuesta)
```

---

## Tablas

### `users`

Tabla central de usuarios del sistema.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | UUID | PK, default gen_random_uuid() | Identificador único |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE, INDEX | Email de acceso (normalizado lowercase) |
| `hashed_password` | VARCHAR(255) | NOT NULL | bcrypt con cost=12 |
| `full_name` | TEXT | NOT NULL, default '' | Nombre completo del usuario |
| `role` | VARCHAR(20) | NOT NULL, default 'operativo' | Rol legacy: `admin` / `operativo` / `lectura` |
| `is_active` | BOOLEAN | NOT NULL, default TRUE | Soft-delete — usuarios desactivados no pueden autenticarse |
| `last_login_at` | TIMESTAMPTZ | NULL | Último inicio de sesión exitoso |
| `created_at` | TIMESTAMPTZ | NOT NULL | Timestamp de creación |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Timestamp de última modificación |
| `totp_secret` | TEXT | NULL | Clave TOTP en Base32 (pyotp); NULL hasta que se configura 2FA |
| `totp_enabled` | BOOLEAN | NOT NULL, default FALSE | `true` cuando el usuario completó el setup de 2FA |
| `totp_setup_at` | TIMESTAMPTZ | NULL | Cuándo activó el 2FA |

**Trigger**: `trg_audit_users` → `fn_audit_changes()` (INSERT/UPDATE/DELETE)

**Nota sistema dual de roles**: `users.role` es el campo legacy que controla quién puede administrar usuarios. Las tablas `roles`/`user_roles` son el RBAC operacional. Ambos coexisten.

---

### `refresh_tokens`

Una fila por sesión activa (máximo 5 por usuario). El token real nunca se almacena: solo su hash SHA-256.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | UUID | PK | Identificador de sesión |
| `user_id` | UUID | FK → users.id CASCADE, INDEX | Propietario |
| `token_hash` | VARCHAR(255) | NOT NULL | SHA-256 del token crudo (hex) |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Expiración (7 días desde emisión) |
| `user_agent` | TEXT | NULL | User-Agent del cliente al crear sesión |
| `ip_address` | TEXT | NULL | IP del cliente al crear sesión |
| `last_used_at` | TIMESTAMPTZ | NULL | Actualizado en cada rotación |
| `created_at` | TIMESTAMPTZ | NOT NULL | Timestamp de creación |

**Comportamiento de sesiones**:
- Al emitir un nuevo token: se eliminan los expirados, y si ya hay 5 activos se elimina el más antiguo.
- En cada refresh: se rota el `token_hash` y se actualiza `last_used_at`.
- Política: no hay `UNIQUE(user_id)` — multi-sesión intencional.

---

### `password_reset_tokens`

Tokens de un solo uso para el flujo "¿Olvidaste tu contraseña?". Se eliminan al consumirse o al generar uno nuevo para el mismo usuario.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | UUID | PK | — |
| `user_id` | UUID | FK → users.id CASCADE, INDEX | Propietario |
| `token_hash` | VARCHAR(255) | NOT NULL, INDEX | SHA-256 del token enviado por email |
| `expires_at` | TIMESTAMPTZ | NOT NULL | 1 hora desde generación |
| `created_at` | TIMESTAMPTZ | NOT NULL | — |

**Flujo**: `POST /api/auth/forgot-password` → genera token → envía email con URL → `POST /api/auth/reset-password` consume token, cambia password e invalida todas las sesiones activas.

---

### `totp_backup_codes`

Códigos de emergencia para cuando el usuario no tiene acceso a su app autenticadora. Cada código es de un solo uso.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | UUID | PK | — |
| `user_id` | UUID | FK → users.id CASCADE, INDEX `ix_tbc_user_id` | Propietario |
| `code_hash` | VARCHAR(255) | NOT NULL | SHA-256 del código crudo normalizado (uppercase) |
| `used_at` | TIMESTAMPTZ | NULL | NULL = disponible; NOT NULL = ya usado |
| `created_at` | TIMESTAMPTZ | NOT NULL | — |

**Generación**: se crean 8 códigos en formato `XXXX-XXXX` (hex aleatorio de 4+4 bytes). El código crudo se muestra al usuario **una sola vez** en la pantalla de setup. Al verificar: se busca por hash y `used_at IS NULL`.

---

### `roles`

Roles RBAC del sistema. Cada rol agrupa un conjunto de permisos.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `role_id` | SMALLINT | PK, IDENTITY ALWAYS | — |
| `code` | TEXT | NOT NULL, UNIQUE `uq_roles_code` | Código en MAYÚSCULAS (ej. `SALES`) |
| `name` | TEXT | NOT NULL | Nombre legible (ej. `Ventas`) |
| `description` | TEXT | NULL | Descripción opcional |

**Roles actuales** (seed migración 0010 + 0011):

| role_id | code | name | Permisos |
|---------|------|------|---------|
| 1 | ADMIN | Administrador | 64 (todos) |
| 2 | SALES | Ventas | 21 |
| 3 | PURCHASING | Compras | 22 |
| 4 | WAREHOUSE | Almacén | 20 |
| 5 | ACCOUNTING | Contabilidad | 22 |
| 6 | READ_ONLY | Solo lectura | 13 |
| 8 | DRIVER | Conductor | 2 |

---

### `permissions`

Catálogo de permisos atómicos. 70 permisos definidos en 24 grupos.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `permission_id` | SMALLINT | PK, IDENTITY ALWAYS | — |
| `code` | TEXT | NOT NULL, UNIQUE | Formato `recurso.accion` (ej. `quote.create`) |
| `description` | TEXT | NULL | Descripción legible |

**Grupos de permisos**:

| Grupo | Permisos |
|-------|---------|
| Usuarios | `user.view`, `user.manage`, `role.manage` |
| Clientes | `customer.view`, `customer.manage` |
| Proveedores | `supplier.view`, `supplier.manage` |
| Productos | `product.view`, `product.manage`, `product.price.manage` |
| Cotizaciones | `quote.view`, `quote.create`, `quote.edit`, `quote.send`, `quote.approve`, `quote.cancel` |
| Pedidos | `order.view`, `order.pack`, `order.ship`, `order.deliver`, `order.cancel` |
| Compras | `purchase_request.create`, `purchase_request.approve`, `purchase_order.create`, `purchase_order.send`, `purchase_order.cancel` |
| Recepciones | `goods_receipt.create`, `goods_receipt.validate` |
| No conformes | `non_conformity.create`, `non_conformity.resolve` |
| Facturas proveedor | `supplier_invoice.capture`, `supplier_invoice.pay` |
| Inventario | `inventory.view`, `inventory.adjust` |
| CFDI | `cfdi.issue`, `cfdi.cancel`, `cfdi.credit_note` |
| Pagos/Gastos | `payment.register`, `expense.create` |
| Reportes | `report.sales`, `report.inventory`, `report.financial` |
| Auditoría | `audit.view` |

---

### `role_permissions`

Tabla puente N:N entre roles y permisos. PK compuesta: `(role_id, permission_id)`.

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `role_id` | SMALLINT | FK → roles.role_id CASCADE |
| `permission_id` | SMALLINT | FK → permissions.permission_id CASCADE |

**Trigger**: `trg_audit_role_permissions` → `fn_audit_changes()`

---

### `user_roles`

Tabla puente N:N entre usuarios y roles RBAC. PK compuesta: `(user_id, role_id)`.

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `user_id` | UUID | FK → users.id CASCADE |
| `role_id` | SMALLINT | FK → roles.role_id CASCADE |
| `granted_at` | TIMESTAMPTZ | NOT NULL, default now() |

**Trigger**: `trg_audit_user_roles` → `fn_audit_changes()`

---

### `audit_log`

Registro inmutable de cambios en tablas críticas. Escritura exclusiva por triggers — nunca por código de aplicación.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `audit_id` | BIGINT | PK, IDENTITY ALWAYS | Auto-incremental |
| `user_id` | UUID | FK → users.id (nullable) | NULL si el cambio fue por sistema/trigger |
| `entity_type` | TEXT | NOT NULL | Nombre de la tabla (ej. `users`) |
| `entity_id` | TEXT | NOT NULL | PK del registro afectado (como texto) |
| `action` | TEXT | NOT NULL, CHECK (INSERT/UPDATE/DELETE) | Tipo de operación |
| `before_data` | JSONB | NULL | Snapshot del registro antes (NULL en INSERT) |
| `after_data` | JSONB | NULL | Snapshot del registro después (NULL en DELETE) |
| `changed_at` | TIMESTAMPTZ | NOT NULL, default now() | Timestamp de la operación |

**Índices**:
- `idx_audit_entity` → `(entity_type, entity_id)` para filtrar por entidad
- `idx_audit_changed_at` → `(changed_at DESC)` para paginación temporal

**Tablas auditadas automáticamente** por trigger:
- `users` — altas, bajas, modificaciones de perfil, activación/desactivación
- `user_roles` — asignación y revocación de roles RBAC
- `role_permissions` — cambios en la matriz de permisos

**Lectura**: `GET /api/admin/audit-log` con filtros por entity_type, entity_id, user_id, rango de fechas.

---

## Trigger `fn_audit_changes`

Función PL/pgSQL compartida por los tres triggers de auditoría.

```sql
CREATE OR REPLACE FUNCTION fn_audit_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_entity_id TEXT;
    v_before JSONB;
    v_after JSONB;
BEGIN
    -- Lee el usuario que ejecuta la operación (si la app lo estableció)
    BEGIN
        v_user_id := current_setting('rtb.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF TG_OP = 'DELETE' THEN
        v_before    := to_jsonb(OLD);  v_after     := NULL;
        v_entity_id := COALESCE(to_jsonb(OLD)->>'id', '');
    ELSIF TG_OP = 'INSERT' THEN
        v_before    := NULL;           v_after     := to_jsonb(NEW);
        v_entity_id := COALESCE(to_jsonb(NEW)->>'id', '');
    ELSE
        v_before    := to_jsonb(OLD);  v_after     := to_jsonb(NEW);
        v_entity_id := COALESCE(to_jsonb(NEW)->>'id', '');
    END IF;

    INSERT INTO audit_log (user_id, entity_type, entity_id, action, before_data, after_data)
    VALUES (v_user_id, TG_TABLE_NAME, v_entity_id, TG_OP, v_before, v_after);

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Migraciones del módulo de seguridad

| Archivo | Revisión | Contenido |
|---------|----------|-----------|
| `20260428_0010_security_rbac_and_audit.py` | `20260428_0010` | Crea: roles, permissions, role_permissions, user_roles, audit_log. Seed inicial 5 roles + 42 permisos. Trigger fn_audit_changes. |
| `20260428_0011_seed_complete_role_migration.py` | `20260428_0011` | Amplía seed: READ_ONLY + DRIVER, permisos adicionales hasta 70. |
| `20260429_0025_mi_cuenta_sesiones.py` | `20260429_0025` | Multi-sesión: DROP UNIQUE(user_id) en refresh_tokens; ADD user_agent, ip_address, last_used_at. |
| `20260429_0026_password_reset_tokens.py` | `20260429_0026` | CREATE TABLE password_reset_tokens. |
| `20260429_0027_totp_2fa.py` | `20260429_0027` | ALTER users ADD totp_secret/totp_enabled/totp_setup_at; CREATE totp_backup_codes. |

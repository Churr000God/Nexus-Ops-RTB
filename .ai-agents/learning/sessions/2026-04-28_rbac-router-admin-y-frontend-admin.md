# Sesion: RBAC — Router Admin (roles/permisos/audit) y Frontend Panel Admin

**Fecha:** 2026-04-28
**Agente:** Claude Sonnet 4.6
**Area:** backend + frontend
**Sprint:** 4
**Duracion aprox:** 90 min

## Objetivo
Completar los pasos 8 y 9 del módulo de seguridad RBAC:
- **Paso 8 (Backend):** Router `/api/admin` con endpoints de consulta para roles, permisos y bitácora de auditoría.
- **Paso 9 (Frontend):** Tipos TS, hook `usePermission`, componente `PermissionGate`, páginas `/admin/usuarios` y `/admin/audit-log`, links en Sidebar.

## Contexto Previo
- Migraciones 0010 y 0011 aplicadas en Supabase: 6 roles, 43 permisos, trigger de auditoría.
- ORM completo: `Role`, `Permission`, `RolePermission`, `UserRole`, `AuditLog`.
- Schemas Pydantic: `RoleSchema`, `PermissionSchema`, `AuditLogEntry` ya existían en `user_schema.py`.
- Router `/api/usuarios` con CRUD de usuarios y asignación de roles (pasos anteriores).
- Frontend con stack React + Zustand + Tailwind + `useApi` hook propio.

## Trabajo Realizado

### Paso 8 — Router /api/admin (backend)

**Schemas nuevos en `user_schema.py`:**
- `RoleWithPermissions`: extiende `RoleSchema` con `permissions: list[PermissionSchema]`.
- `AuditLogPage`: `{ items: list[AuditLogEntry], total: int }` para respuesta paginada.

**`backend/app/services/admin_service.py`** (nuevo):
- `list_roles_with_permissions()`: usa `selectinload(Role.role_permissions).selectinload(RolePermission.permission)` — evita N+1 completamente.
- `list_permissions()`: query directa ordenada por código.
- `list_audit_log(...)`: query con filtros opcionales (entity_type, entity_id, user_id, from_date, to_date) + paginación (offset/limit) + COUNT total en subquery.

**`backend/app/routers/admin.py`** (nuevo):
- `GET /api/admin/roles` → protegido con `role.manage`.
- `GET /api/admin/permissions` → protegido con `role.manage`.
- `GET /api/admin/audit-log` → protegido con `audit.view`, parámetros opcionales vía `Query`.
- `main.py`: registra `admin_router`.

**Fix en `routers/usuarios.py`:**
- `DELETE /{user_id}/roles/{role_code}` cambiado de `-> None` + `status_code=204` a `-> Response` retornando `Response(status_code=204)`. La versión instalada de FastAPI lanza `AssertionError: Status code 204 must not have a response body` con `-> None`.

### Paso 9 — Frontend Panel Admin

**Tipos:**
- `frontend/src/types/auth.ts`: `User` actualizado con `full_name`, `last_login_at`, `roles: string[]`, `permissions: string[]` (para reflejar la respuesta real de `/api/auth/me`).
- `frontend/src/types/admin.ts` (nuevo): `Permission`, `Role`, `AuditLogEntry`, `AuditLogPage`, `AuditLogParams`.

**Hook `usePermission`** (`frontend/src/hooks/usePermission.ts`):
- Lee `user?.permissions` desde el store Zustand.
- Devuelve `boolean` — compatible con `PermissionGate` y condicionales directas.

**Componente `PermissionGate`** (`frontend/src/components/common/PermissionGate.tsx`):
- Wrapper de render condicional: `<PermissionGate permission="user.manage">`.
- Acepta `fallback` opcional para mostrar contenido alternativo.

**`frontend/src/services/adminService.ts`** (nuevo):
- `listUsers`, `listRoles`, `listPermissions`, `listAuditLog` (con `URLSearchParams` dinámico).
- `assignRole` / `revokeRole` — mutaciones con token.

**Página `/admin/usuarios`** (`frontend/src/pages/AdminUsuarios.tsx`):
- `DataTable` con 6 columnas: email, nombre, roles (badges con colores por rol), estado (badge activo/inactivo), último acceso, botón "Roles".
- `RoleModal`: overlay con roles activos (X para revocar) y roles disponibles (+ para asignar). Actualización optimista de `selectedUser` + refetch en background.
- Verifica permiso `user.view` al cargar; botón "Roles" solo visible si `role.manage`.

**Página `/admin/audit-log`** (`frontend/src/pages/AdminAuditLog.tsx`):
- Barra de filtros con 5 campos: entity_type, entity_id, user_id, from_date, to_date. Filtros se aplican al hacer clic en "Buscar" (evita fetch por tecla).
- `DataTable` con `maxHeight="520px"` y paginación prev/next.
- `DiffModal`: muestra `before_data` / `after_data` en dos columnas con `<pre>` + JSON.stringify. Se abre con "Ver diff" por fila.

**Routing y navegación:**
- `routes.tsx`: rutas `/admin/usuarios` y `/admin/audit-log` dentro del `Shell` existente.
- `Sidebar.tsx`: sección "Administración" con links **Usuarios** y **Bitácora** visibles solo si el usuario tiene `user.view` o `audit.view` respectivamente.

## Decisiones Tomadas

- **Optimistic update en RoleModal vs cierre al confirmar:** se eligió actualizar `selectedUser` optimísticamente para que el admin pueda asignar/revocar múltiples roles sin cerrar el modal. La tabla se refresca con `refetchUsers()` en background.
- **Filtros de auditoría con "Buscar" explícito:** evita fetch en cada keystroke. La bitácora puede crecer mucho; aplicar filtros solo al hacer clic es más eficiente.
- **`DiffModal` separado vs fila expandible:** el componente `DataTable` no soporta filas expandibles. Se eligió modal overlay en lugar de modificar el componente compartido.
- **`usePermission` sobre store Zustand (no JWT parseado):** el `user.permissions` viene de `/api/auth/me` (cargado en bootstrap), que ya consulta la BD. Más limpio que parsear el JWT en el cliente.
- **Badge de roles con colores hardcodeados:** los 6 roles del seed tienen colores fijos (ADMIN=purple, SALES=blue, etc.). Suficiente para la fase actual; si se agregan roles dinámicos se puede extender.

## Errores Encontrados

- **FastAPI 204 con `-> None`:** `AssertionError: Status code 204 must not have a response body`. El router de usuarios tenía `-> None` con `status_code=204`. Fix: retornar `Response(status_code=204)` con `-> Response`.
- **BD vacía al desplegar:** las migraciones se aplican en Supabase pero no crean usuarios. Se creó el admin con `scripts/create_admin_user.py` + asignación manual del rol ADMIN en `user_roles`.
- **Relay Supabase apagado:** Docker no puede completar TLS handshake con Supabase directamente. Hay que correr `python scripts/supabase-relay.py` antes de `docker compose up`.

## Lecciones Aprendidas

- En FastAPI moderno (≥0.109), retornar `Response(status_code=204)` es el patrón correcto para DELETE sin cuerpo. Anotar `-> None` no es suficiente.
- `selectinload(rel1).selectinload(rel2)` carga relaciones anidadas en 2 queries adicionales (no N+1), lo que es suficiente para el tamaño actual de la BD de roles.
- Después de migraciones que hacen seed de datos relacionales, verificar que los registros de la tabla principal (users) existan; las migraciones que hacen INSERT condicional no fallan con BD vacía pero tampoco crean el dato base.

## Archivos Modificados

**Backend:**
- `backend/app/schemas/user_schema.py` — `+RoleWithPermissions`, `+AuditLogPage`
- `backend/app/services/admin_service.py` — nuevo: `AdminService` con 3 métodos
- `backend/app/routers/admin.py` — nuevo: 3 endpoints `/api/admin/*`
- `backend/app/routers/usuarios.py` — fix DELETE 204: `-> Response`
- `backend/app/main.py` — registra `admin_router`

**Frontend:**
- `frontend/src/types/auth.ts` — `User`: `+full_name`, `+last_login_at`, `+roles[]`, `+permissions[]`
- `frontend/src/types/admin.ts` — nuevo: tipos admin completos
- `frontend/src/hooks/usePermission.ts` — nuevo
- `frontend/src/components/common/PermissionGate.tsx` — nuevo
- `frontend/src/services/adminService.ts` — nuevo
- `frontend/src/pages/AdminUsuarios.tsx` — nuevo
- `frontend/src/pages/AdminAuditLog.tsx` — nuevo
- `frontend/src/routes.tsx` — rutas `/admin/usuarios` y `/admin/audit-log`
- `frontend/src/components/layout/Sidebar.tsx` — sección Administración

## Siguiente Paso
- Fase 4 verificación completa en el browser: probar gestión de roles desde la UI, verificar que los permisos del JWT se reflejan en el sidebar (solo visible para roles con `user.view`/`audit.view`).
- Sprint 5: módulo de clientes (alta, edición, detalle) — primer módulo operativo del CRUD de negocio.

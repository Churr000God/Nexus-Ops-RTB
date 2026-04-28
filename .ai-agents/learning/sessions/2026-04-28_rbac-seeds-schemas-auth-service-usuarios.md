# Sesion: RBAC — Seeds, Schemas, Auth Service y Router Usuarios

**Fecha:** 2026-04-28
**Agente:** Claude Sonnet 4.6
**Area:** backend
**Sprint:** 4
**Duracion aprox:** 90 min

## Objetivo
Completar los pasos 2–7 del módulo de seguridad RBAC: seeds SQL completos, schemas Pydantic, auth service actualizado con permisos en JWT, dependency `require_permission`, y router CRUD de usuarios con asignación de roles.

## Contexto Previo
- Migración 0010 ya aplicada en Supabase: DDL de roles/permissions/user_roles/audit_log + seeds básicos (5 roles, 42 permisos, matriz role_permissions, migración admin→ADMIN).
- Modelos ORM ya existentes en `user_model.py`.
- Auth service y router con JWT sin permisos granulares.

## Trabajo Realizado

### Paso 2 — Seeds SQL completos (migración 0011)
- Nuevo rol `READ_ONLY` con 11 permisos de solo lectura.
- Migración de datos: `role='operativo'` → SALES + WAREHOUSE; `role='lectura'` → READ_ONLY.
- Aplicada en Supabase vía MCP. Resultado: 6 roles activos.

### Paso 3 — Modelos SQLAlchemy
- Ya estaban completos desde la sesión anterior (0010). Sin cambios.

### Paso 4 — Schemas Pydantic
- `RegisterRequest`: + `full_name`.
- `UserResponse`: + `ConfigDict(from_attributes=True)`, `full_name`, `last_login_at`, `roles: list[str]`, `permissions: list[str]`.
- Nuevo `user_schema.py`: `RoleSchema`, `PermissionSchema`, `UserUpdateSchema`, `AssignRoleRequest`, `AuditLogEntry`.

### Paso 5 — Auth Service actualizado
- `register_user`: pasa `full_name` al constructor de `User`.
- `authenticate_user`: setea `last_login_at`, carga permisos, retorna `tuple[User, list[str]]`.
- `get_user_permissions`: query con 4 JOINs `users→user_roles→roles→role_permissions→permissions`.
- `get_user_roles`: query con 2 JOINs para lista de códigos de rol.
- `create_access_token(user, permissions)`: incluye `"permissions"` en el payload JWT.
- `auth.py` router: actualizado login (desempaqueta tuple), refresh (llama `get_user_permissions`), register (agrega `full_name`), `/me` (carga roles+permisos de DB).

### Paso 6 — Dependency require_permission
- `require_permission(permission)` en `dependencies.py`: lee `permissions` de `request.state.token_payload` (JWT decodificado por middleware), delega autenticación a `get_current_user`, retorna `User`.
- `require_roles` marcada como legacy con comentario.

### Paso 7 — Router /api/usuarios
- Nuevo `user_service.py` con `UserService`: `list_users` (2 queries, sin N+1), `update_user`, `assign_role` (idempotente), `revoke_role` (idempotente), `get_user_roles`.
- Nuevo `routers/usuarios.py`: 5 endpoints protegidos con `require_permission`.
- `main.py`: registra `usuarios_router`.

## Decisiones Tomadas
- **JWT vs DB para permisos en `require_permission`:** se leen del JWT (sin DB query adicional). Los permisos se refrescan en cada login y en cada `/refresh`. Tradeoff aceptado: permisos stale hasta que el token expire (access token corto mitiga esto).
- **`permissions=[]` en lista de usuarios:** la vista de lista no carga permisos (muy costoso). Solo `/me` y los endpoints de detalle los incluyen.
- **READ_ONLY como 6to rol:** no estaba en el plan original de 5 roles, pero era necesario para mapear `role='lectura'` sin dejar esos usuarios sin acceso.
- **Idempotencia en assign/revoke_role:** evita errores en UI cuando el estado ya fue alcanzado (botón doble clic, retry).

## Errores Encontrados
- Las edits 2 y 3 de `auth_service.py` no se aplicaron en el primer intento (el tool retornó "success" pero el archivo no cambió). Fue necesario repetir los edits con la misma cadena exacta. Se aplicaron correctamente en el segundo intento.

## Lecciones Aprendidas
- Siempre verificar el archivo con `Read` después de múltiples `Edit` consecutivos sobre el mismo archivo — los edits pueden reportar éxito sin aplicar el cambio si hay inconsistencias de whitespace interno.
- `select_from(User).join(...)` es la forma explícita en SQLAlchemy para iniciar un JOIN desde una tabla que no es la del `select()`.

## Archivos Modificados
- `backend/alembic/versions/20260428_0011_seed_complete_role_migration.py` — nuevo: rol READ_ONLY + migración de datos legacy
- `backend/app/schemas/auth_schema.py` — RegisterRequest + full_name; UserResponse + RBAC fields
- `backend/app/schemas/user_schema.py` — nuevo: RoleSchema, PermissionSchema, UserUpdateSchema, AssignRoleRequest, AuditLogEntry
- `backend/app/services/auth_service.py` — authenticate_user retorna tuple; get_user_permissions (4 JOINs); get_user_roles; create_access_token con permissions
- `backend/app/services/user_service.py` — nuevo: UserService CRUD + asignación roles
- `backend/app/routers/auth.py` — login/refresh/me actualizados
- `backend/app/routers/usuarios.py` — nuevo: 5 endpoints RBAC-protected
- `backend/app/dependencies.py` — require_permission añadida; require_roles marcada legacy
- `backend/app/main.py` — registra usuarios_router

## Siguiente Paso
- Fase 4 — Verificar: hacer `docker compose up -d --build backend` y probar con Swagger (`/docs`):
  1. `POST /api/auth/register` con `full_name`
  2. `POST /api/auth/login` → verificar JWT incluye `permissions`
  3. `GET /api/usuarios` sin token → debe retornar 401
  4. `GET /api/usuarios` con token admin → lista con roles
  5. `POST /api/usuarios/{id}/roles` → asignar SALES a un usuario

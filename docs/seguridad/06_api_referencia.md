# API — Referencia de Endpoints de Seguridad

Base URL: `http://localhost:8000` (dev) / `https://api.nexusops.rtb` (prod)

Prefijos:
- `/api/auth` — Autenticación propia del usuario
- `/api/usuarios` — CRUD de usuarios (requiere permiso `user.*`)
- `/api/admin` — Roles, permisos, audit log (requiere permiso `role.manage` o `audit.view`)

---

## `/api/auth` — Autenticación

### POST `/api/auth/login`

Primer paso del login. Valida credenciales y emite el token MFA.

**Request:**
```json
{ "email": "usuario@empresa.com", "password": "Contraseña123" }
```

**Response 200:**
```json
{ "mfa_token": "eyJ...", "totp_configured": false }
```

**Errores:**
- `401` — Credenciales inválidas o usuario inactivo

---

### POST `/api/auth/totp/setup`

Inicia el setup de TOTP. Genera un secret y retorna el URI para el QR.

**Auth:** `Authorization: Bearer <mfa_token>` (type=mfa_pending)

**Request:** body vacío (POST sin body)

**Response 200:**
```json
{
  "secret": "U37TCMG7LP3GKFJINWKVLEF5XERSKYGJ",
  "qr_uri": "otpauth://totp/Nexus%20Ops%20RTB:usuario%40empresa.com?secret=...&issuer=Nexus%20Ops%20RTB"
}
```

**Errores:**
- `401` — mfa_token inválido, expirado o no es de tipo mfa_pending

---

### POST `/api/auth/totp/setup/confirm`

Confirma el setup validando el primer código. Emite tokens de sesión y devuelve backup codes.

**Auth:** `Authorization: Bearer <mfa_token>`

**Request:**
```json
{ "code": "123456" }
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "backup_codes": ["A3F2-8C91", "7B0D-E452", "C19F-3A87", "D48E-2B76", "E501-9C43", "F612-0D18", "G723-1E05", "H834-2F92"]
}
```
+ `Set-Cookie: refresh_token=...; HttpOnly; ...`

**Errores:**
- `400` — Código TOTP incorrecto
- `401` — mfa_token inválido

---

### POST `/api/auth/totp/verify`

Verifica TOTP en cada login. Acepta código de app autenticadora O código de respaldo.

**Auth:** `Authorization: Bearer <mfa_token>`

**Request:**
```json
{ "code": "654321" }
```
o código de respaldo:
```json
{ "code": "A3F2-8C91" }
```

**Response 200:**
```json
{ "access_token": "eyJ...", "token_type": "bearer" }
```
+ `Set-Cookie: refresh_token=...`

**Errores:**
- `400` — Código incorrecto (TOTP inválido o backup code ya usado/inexistente)
- `401` — mfa_token inválido

---

### POST `/api/auth/refresh`

Rota el refresh token y emite un nuevo access token. El browser envía la cookie automáticamente.

**Auth:** Cookie `refresh_token` (HttpOnly)

**Request:** body vacío `{}`

**Response 200:**
```json
{ "access_token": "eyJ...", "token_type": "bearer" }
```
+ `Set-Cookie: refresh_token=...` (token rotado)

**Errores:**
- `401` — Cookie ausente, token inválido o expirado

---

### POST `/api/auth/logout`

Revoca la sesión actual.

**Auth:** Cookie `refresh_token`

**Response 204** — sin body
+ `Set-Cookie: refresh_token=; max-age=0` (elimina la cookie)

---

### GET `/api/auth/me`

Retorna el perfil completo del usuario autenticado con roles y permisos.

**Auth:** `Authorization: Bearer <access_token>`

**Response 200:**
```json
{
  "id": "uuid",
  "email": "usuario@empresa.com",
  "full_name": "Juan Pérez",
  "role": "operativo",
  "is_active": true,
  "last_login_at": "2026-04-29T10:30:00Z",
  "created_at": "2026-04-01T08:00:00Z",
  "roles": ["SALES", "ACCOUNTING"],
  "permissions": ["cfdi.issue", "customer.view", "quote.create", ...]
}
```

---

### PATCH `/api/auth/me`

Actualiza el nombre completo del usuario.

**Auth:** `Authorization: Bearer <access_token>`

**Request:**
```json
{ "full_name": "Juan Antonio Pérez" }
```

**Response 200:** UserResponse (igual que GET /me)

---

### POST `/api/auth/me/password`

Cambia la contraseña propia. Invalida todas las sesiones.

**Auth:** `Authorization: Bearer <access_token>`

**Request:**
```json
{
  "current_password": "ContraseñaActual1",
  "new_password": "NuevaContraseña2"
}
```

**Response 204**

**Errores:**
- `400` — Contraseña actual incorrecta

---

### GET `/api/auth/me/sessions`

Lista las sesiones activas del usuario.

**Auth:** `Authorization: Bearer <access_token>`

**Response 200:**
```json
[
  {
    "id": "uuid",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    "ip_address": "192.168.1.100",
    "created_at": "2026-04-29T10:00:00Z",
    "last_used_at": "2026-04-29T14:32:00Z",
    "is_current": true
  }
]
```

Solo devuelve sesiones no expiradas (`expires_at > now()`).

---

### DELETE `/api/auth/me/sessions/{session_id}`

Revoca una sesión específica.

**Auth:** `Authorization: Bearer <access_token>`

**Response 204**

---

### DELETE `/api/auth/me/sessions`

Revoca todas las sesiones excepto la actual.

**Auth:** `Authorization: Bearer <access_token>`

**Response 204**

---

### POST `/api/auth/forgot-password`

Inicia el flujo de reset de contraseña. Siempre responde 204 (evita enumeración de emails).

**Request:**
```json
{ "email": "usuario@empresa.com" }
```

**Response 204** — Si el email existe, envía un correo vía MailerSend con el enlace de reset.

---

### POST `/api/auth/reset-password`

Consume el token de reset y establece la nueva contraseña.

**Request:**
```json
{ "token": "raw_token_del_email", "new_password": "NuevoPassword123" }
```

**Response 204**

**Errores:**
- `400` — Token inválido o expirado

---

## `/api/usuarios` — Gestión de usuarios

Todos los endpoints requieren el access token y el permiso indicado.

### GET `/api/usuarios`

Lista todos los usuarios con sus roles RBAC.

**Permiso:** `user.view`

**Response 200:** `UserResponse[]`

---

### POST `/api/usuarios`

Crea un nuevo usuario.

**Permiso:** `user.manage`

**Request:**
```json
{
  "email": "nuevo@empresa.com",
  "full_name": "Nombre Completo",
  "password": "Password123",
  "role": "operativo"
}
```

**Response 201:** `UserResponse`

**Errores:**
- `409` — Email ya existe

---

### GET `/api/usuarios/{user_id}`

Obtiene un usuario por ID.

**Permiso:** `user.view`

**Response 200:** `UserResponse`

---

### PATCH `/api/usuarios/{user_id}`

Edita email, nombre o activa/desactiva al usuario.

**Permiso:** `user.manage`

**Request:**
```json
{ "email": "nuevo@empresa.com", "full_name": "Nuevo Nombre", "is_active": false }
```

**Response 200:** `UserResponse`

---

### PATCH `/api/usuarios/{user_id}/password`

Cambia la contraseña de un usuario (solo admin puede cambiar a no-admin).

**Permiso:** legacy role `admin` (no RBAC)

**Request:**
```json
{ "password": "NuevoPassword123" }
```

**Response 204**

**Errores:**
- `403` — No puede cambiar contraseña de otro admin
- `404` — Usuario no encontrado

---

### POST `/api/usuarios/{user_id}/roles`

Asigna un rol RBAC a un usuario.

**Permiso:** `user.manage`

**Request:**
```json
{ "role_code": "SALES" }
```

**Response 200:** `UserResponse`

---

### DELETE `/api/usuarios/{user_id}/roles/{role_code}`

Revoca un rol RBAC de un usuario.

**Permiso:** `user.manage`

**Response 204**

---

## `/api/admin` — Roles, Permisos, Auditoría

### GET `/api/admin/roles`

Lista todos los roles con sus permisos.

**Permiso:** `role.manage`

**Response 200:** `RoleWithPermissions[]`

---

### POST `/api/admin/roles`

Crea un nuevo rol.

**Permiso:** `role.manage`

**Request:**
```json
{ "code": "LOGISTICS", "name": "Logística", "description": "...", "permission_codes": ["order.ship"] }
```

**Response 201:** `RoleWithPermissions`

**Errores:**
- `409` — Código de rol ya existe
- `422` — Algún permission_code no existe

---

### PUT `/api/admin/roles/{role_id}/permissions`

Reemplaza completamente los permisos de un rol.

**Permiso:** `role.manage`

**Request:**
```json
{ "permission_codes": ["order.view", "order.ship", "order.deliver", "inventory.view"] }
```

**Response 200:** `RoleWithPermissions`

**Errores:**
- `403` — No se pueden modificar los permisos del rol ADMIN
- `404` — Rol no encontrado

---

### GET `/api/admin/permissions`

Lista todos los permisos disponibles.

**Permiso:** `role.manage`

**Response 200:** `PermissionSchema[]`

---

### GET `/api/admin/audit-log`

Consulta la bitácora de auditoría con filtros opcionales.

**Permiso:** `audit.view`

**Query params:**
- `entity_type` — filtrar por tabla (ej. `users`)
- `entity_id` — filtrar por ID del registro
- `user_id` — filtrar por usuario que realizó el cambio
- `from_date` / `to_date` — rango de fechas ISO 8601
- `offset` — paginación (default 0)
- `limit` — registros por página (default 50, max 200)

**Response 200:**
```json
{
  "items": [
    {
      "audit_id": 1234,
      "user_id": "uuid-del-usuario",
      "entity_type": "users",
      "entity_id": "uuid-del-registro",
      "action": "UPDATE",
      "before_data": { "is_active": true, ... },
      "after_data": { "is_active": false, ... },
      "changed_at": "2026-04-29T15:00:00Z"
    }
  ],
  "total": 4500
}
```

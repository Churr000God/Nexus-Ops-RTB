# Autenticación y Tokens

---

## Contraseñas

### Política de contraseñas

Al registrar o cambiar contraseña se validan estas reglas (Pydantic validator + límite bcrypt):

- Longitud mínima: **10 caracteres**
- Longitud máxima: **128 caracteres** (72 bytes en UTF-8, límite de bcrypt)
- Debe contener al menos **una letra** y **un dígito**

### Hash de contraseñas

```python
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

AuthService.hash_password(password)   # → bcrypt hash
AuthService.verify_password(raw, hash)  # → bool
```

`cost=12` es deliberado: suficientemente lento para dificultar ataques de fuerza bruta, tolerable en autenticación interactiva.

---

## Tokens JWT

### Access Token

Firmado con HS256 usando `JWT_SECRET` del entorno. TTL configurable vía `ACCESS_TOKEN_EXPIRE_MINUTES` (default **30 min**).

**Payload:**
```json
{
  "sub": "uuid-del-usuario",
  "email": "usuario@empresa.com",
  "role": "operativo",
  "permissions": ["quote.view", "quote.create", "order.view", ...],
  "iat": 1234567890,
  "exp": 1234569690
}
```

El campo `permissions` es la lista completa de permisos atómicos del usuario (calculada con 4 JOINs: `users → user_roles → roles → role_permissions → permissions`). Este array se embebe en el JWT para que cada endpoint pueda verificar permisos **sin consultar la BD**.

### MFA Token (`mfa_pending`)

Token de vida corta (TTL **5 min**) emitido por `POST /api/auth/login`. Es un JWT especial que solo sirve como challenge para completar el proceso de 2FA.

**Payload:**
```json
{
  "sub": "uuid-del-usuario",
  "type": "mfa_pending",
  "iat": 1234567890,
  "exp": 1234568190
}
```

**Diferencias vs access token:**
- No contiene `email`, `role` ni `permissions`
- Tiene `"type": "mfa_pending"` 
- Es **rechazado** por `get_current_user` (retorna 401)
- Solo es aceptado por `require_mfa_challenge`
- No se persiste en `localStorage` (excluido del `partialize` de Zustand)

---

## Refresh Tokens

### Emisión

Al completar TOTP (setup/verify), el backend:
1. Genera `secrets.token_urlsafe(48)` — 48 bytes de entropía aleatoria
2. Guarda `SHA-256(token)` en `refresh_tokens`
3. Envía el token crudo en una cookie HttpOnly

**Cookie:**
```
Set-Cookie: refresh_token=<raw_token>; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=604800
```

- `HttpOnly` → JavaScript no puede leerla
- `SameSite=Strict` → CSRF mitigado
- `Secure` → activado en producción (ENV != development)
- `Path=/api/auth` → la cookie solo se envía a endpoints de auth

### Rotación

`POST /api/auth/refresh` rota el token:
1. Recibe cookie con token crudo
2. Calcula hash y busca en BD
3. Verifica que no haya expirado
4. Genera un nuevo token crudo → actualiza `token_hash` y `last_used_at` en el mismo registro
5. Retorna el nuevo `access_token`

Esto implementa **single-use refresh tokens**: si un token robado se intenta usar después de que el usuario legítimo ya lo rotó, el hash no existe y se devuelve 401.

### Multi-sesión (máximo 5)

```python
# Al emitir nuevo refresh token:
# 1. Eliminar tokens expirados del usuario
# 2. Si quedan >= 5 activos → eliminar el más antiguo
# 3. Insertar el nuevo
```

La sesión más antigua se expulsa automáticamente cuando se supera el límite. El usuario puede ver y revocar sus sesiones desde `/cuenta/sesiones`.

---

## Flujo completo de autenticación

### Login con TOTP ya configurado

```
1. POST /api/auth/login { email, password }
      ↓ bcrypt.verify → OK
      ↓ UPDATE users.last_login_at
      ↓ create_mfa_token() → JWT type="mfa_pending" TTL=5min
   ← 200 { mfa_token: "eyJ...", totp_configured: true }

2. Frontend: status = "mfa_verify" → navigate("/verify-2fa")

3. POST /api/auth/totp/verify { code: "123456" }
      Authorization: Bearer <mfa_token>
      ↓ require_mfa_challenge verifica type == "mfa_pending"
      ↓ pyotp.TOTP.verify(code, valid_window=1)  — ±1 período de 30s
      ↓ create_access_token(user, permissions)
      ↓ issue_refresh_token(user_id, user_agent, ip_address)
   ← 200 { access_token: "eyJ..." }
      Set-Cookie: refresh_token=...

4. Frontend: status = "authenticated" → navigate("/")
```

### Bootstrap al recargar la página

```
1. Zustand carga { accessToken, user } de localStorage

2. Si accessToken existe:
   GET /api/auth/me  Authorization: Bearer <accessToken>
   ← 200 { id, email, roles, permissions }
   → status = "authenticated"

   Si falla (token expirado):
   → accessToken = null, continúa al paso 3

3. Si no hay accessToken (o falló):
   POST /api/auth/refresh  (envía cookie automáticamente)
   ← 200 { access_token }
   GET /api/auth/me
   → status = "authenticated"

   Si no hay cookie o expiró:
   → status = "anonymous" → redirige a /login
```

---

## Flujo de reset de contraseña

```
1. POST /api/auth/forgot-password { email: "user@empresa.com" }
   ← 204 (siempre, aunque el email no exista — evita enumeración de usuarios)

   Backend (si el email existe):
   - Genera secrets.token_urlsafe(48)
   - Guarda SHA-256(token) en password_reset_tokens con TTL=1h
   - Envía email vía MailerSend:
     Subject: "Restablece tu contraseña — Nexus Ops RTB"
     URL: {FRONTEND_URL}/reset-password?token=<raw_token>

2. Usuario abre el enlace en el email

3. POST /api/auth/reset-password { token: "...", new_password: "NuevaPass123" }
   - Busca token por hash en password_reset_tokens
   - Verifica que expires_at > now()
   - Actualiza users.hashed_password
   - DELETE password_reset_tokens (consume el token)
   - DELETE refresh_tokens WHERE user_id = ? (invalida todas las sesiones)
   ← 204

4. Frontend redirige a /login con mensaje de éxito
```

---

## Logout

```
POST /api/auth/logout

Backend:
- Lee cookie refresh_token
- DELETE refresh_tokens WHERE token_hash = SHA-256(cookie)
- Elimina la cookie (Set-Cookie con max-age=0)
← 204

Frontend (Zustand):
- accessToken = null
- user = null
- status = "anonymous"
- mfaToken = null
```

---

## Cambio de contraseña propio

Solo disponible para el propio usuario (no para admins sobre otros usuarios):

```
POST /api/auth/me/password
Authorization: Bearer <access_token>
{
  "current_password": "ContraseñaActual1",
  "new_password": "NuevaContraseña2"
}

Backend:
- bcrypt.verify(current_password) → si falla → 400
- Actualiza hashed_password
- DELETE refresh_tokens WHERE user_id = ? (invalida todas las sesiones incluyendo la actual)
← 204

Frontend: tras 204 → logout + navigate("/login") con mensaje de éxito
```

---

## Gestión de sesiones activas

```
GET /api/auth/me/sessions
← [
    {
      "id": "uuid",
      "user_agent": "Mozilla/5.0 (Windows NT...)",
      "ip_address": "192.168.1.100",
      "created_at": "2026-04-29T10:00:00Z",
      "last_used_at": "2026-04-29T14:32:00Z",
      "is_current": true
    },
    ...
  ]

DELETE /api/auth/me/sessions/{session_id}   ← revocar una sesión específica
DELETE /api/auth/me/sessions               ← revocar todas excepto la actual
```

Solo se devuelven sesiones cuyo `expires_at > now()`. `is_current` se determina comparando el hash de la cookie del request con `token_hash` de cada registro.

# Arquitectura y Tecnologías — Módulo de Seguridad

## Stack tecnológico

### Backend

| Componente | Tecnología | Versión | Rol |
|------------|------------|---------|-----|
| Framework API | FastAPI | ≥0.110 | Endpoints HTTP, validación de esquemas |
| ORM | SQLAlchemy (async) | 2.x | Modelos y queries a PostgreSQL |
| Base de datos | PostgreSQL (Supabase) | 15 | Almacenamiento persistente |
| Hashing de contraseñas | passlib + bcrypt | rounds=12 | Hash seguro de passwords |
| JWT | python-jose | — | Firmar y verificar tokens HS256 |
| TOTP / 2FA | pyotp | 2.9.0 | Generación y verificación de códigos TOTP |
| Hashing de tokens | hashlib SHA-256 | stdlib | Hash de refresh tokens y backup codes en BD |
| Email (reset password) | MailerSend API + httpx | — | Envío de emails transaccionales |
| Caché / sesiones Redis | Redis | 7 | No se usa para auth (stateless con JWT) |
| Validación de esquemas | Pydantic v2 | — | Request/Response models, validadores de campo |

### Frontend

| Componente | Tecnología | Versión | Rol |
|------------|------------|---------|-----|
| Framework | React | 18 | UI |
| Estado global de auth | Zustand + persist | — | AuthStore con partialize |
| Router | React Router v6 | — | Rutas protegidas, redirecciones MFA |
| Generador de QR | react-qr-code | ^2.0.15 | Renderizado SVG del URI TOTP |
| Peticiones HTTP | fetch nativo + wrapper | — | `requestJson` en `/lib/http.ts` |
| Estilos | Tailwind CSS | — | Tema oscuro #0f1115 / #1a1d21 |
| TypeScript | TypeScript | ≥5 | Tipos estrictos end-to-end |

---

## Diagrama de arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Browser)                        │
│                                                                 │
│  localStorage:  { accessToken, user }  ← Zustand persist       │
│  Cookie HttpOnly: refresh_token        ← Set-Cookie del server  │
│                                                                 │
│  Páginas de auth:   /login  /setup-2fa  /verify-2fa             │
│  Páginas Mi Cuenta: /cuenta/perfil  /password  /sesiones        │
│  Panel Admin:       /admin/usuarios  /roles  /audit-log         │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTPS  Bearer <access_token>
                       │        Cookie refresh_token (httponly)
┌──────────────────────▼──────────────────────────────────────────┐
│                    FASTAPI  (Docker backend)                     │
│                                                                 │
│  Middleware auth_context_middleware                              │
│    → decode_bearer_token_from_header()                          │
│    → request.state.token_payload = { sub, type, permissions }   │
│                                                                 │
│  Dependencies:                                                  │
│    get_current_user       ← rechaza type == "mfa_pending"       │
│    require_mfa_challenge  ← solo acepta type == "mfa_pending"   │
│    require_permission(p)  ← verifica permissions[] en JWT       │
│                                                                 │
│  Routers:  /api/auth  /api/usuarios  /api/admin                 │
│  Services: AuthService  UserService  AdminService               │
└──────────────────────┬──────────────────────────────────────────┘
                       │ asyncpg (SQLAlchemy async)
┌──────────────────────▼──────────────────────────────────────────┐
│                  POSTGRESQL  (Supabase externo)                  │
│                                                                 │
│  users  refresh_tokens  password_reset_tokens                   │
│  roles  permissions  role_permissions  user_roles               │
│  audit_log  totp_backup_codes                                   │
│                                                                 │
│  Trigger: fn_audit_changes → INSERT INTO audit_log              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flujos de alto nivel

### 1. Login completo (primera vez sin TOTP)

```
Browser                      FastAPI                    PostgreSQL
  │                             │                           │
  │─ POST /api/auth/login ──────▶                           │
  │  { email, password }        │─ SELECT users WHERE ──────▶
  │                             │  email = ?               │
  │                             │◀─ user row ───────────────│
  │                             │                           │
  │                             │  bcrypt.verify(pwd)       │
  │                             │  UPDATE last_login_at     │
  │                             │                           │
  │                             │  create_mfa_token()       │
  │                             │  JWT type="mfa_pending"   │
  │                             │  TTL = 5 minutos          │
  │◀─ 200 { mfa_token,          │                           │
  │         totp_configured:    │                           │
  │         false } ────────────│                           │
  │                             │                           │
  │  navigate("/setup-2fa")     │                           │
  │                             │                           │
  │─ POST /api/auth/totp/setup ─▶                           │
  │  Authorization: Bearer      │  require_mfa_challenge    │
  │  <mfa_token>                │  (verifica type ==        │
  │                             │   "mfa_pending")          │
  │                             │                           │
  │                             │  pyotp.random_base32()    │
  │                             │  UPDATE users.totp_secret │
  │◀─ 200 { secret, qr_uri } ───│                           │
  │                             │                           │
  │  [usuario escanea QR]       │                           │
  │                             │                           │
  │─ POST /totp/setup/confirm ──▶                           │
  │  { code: "123456" }         │  pyotp.TOTP.verify()      │
  │                             │  totp_enabled = true      │
  │                             │  genera 8 backup codes    │
  │                             │  INSERT totp_backup_codes │
  │                             │                           │
  │                             │  create_access_token()    │
  │                             │  issue_refresh_token()    │
  │◀─ 200 {                     │                           │
  │    access_token,            │─ SET-COOKIE refresh_token │
  │    backup_codes: [8] }      │                           │
  │                             │                           │
  │  store.status = "auth"      │                           │
  │  navigate("/")              │                           │
```

### 2. Login con TOTP ya configurado

```
Browser                      FastAPI
  │─ POST /api/auth/login ──────▶ { mfa_token, totp_configured: true }
  │  navigate("/verify-2fa")
  │
  │─ POST /api/auth/totp/verify ─▶
  │  { code: "654321" }           pyotp.TOTP.verify() OR backup_code check
  │◀─ 200 { access_token }         SET-COOKIE refresh_token
  │  navigate("/")
```

### 3. Refresh silencioso (bootstrap)

```
Browser (app init)           FastAPI
  │                             │
  │  Zustand: accessToken?      │
  │  ─ Sí → GET /api/auth/me ──▶  valida JWT, retorna User+perms
  │  ─ No → POST /api/auth/refresh (con cookie)
  │           ──────────────────▶  verifica refresh_token hash en BD
  │           ◀── { access_token } rotate token (nuevo hash, misma sesión)
  │           ─ GET /api/auth/me ──▶ retorna User
```

### 4. Flujo de permisos en cada request

```
Request: POST /api/cfdi/emitir
   │
   ▼
auth_context_middleware
   → decode Bearer token
   → request.state.token_payload = { sub, email, role, permissions: ["cfdi.issue", ...] }
   │
   ▼
require_permission("cfdi.issue")
   → token_payload["permissions"]  contiene "cfdi.issue"? → OK
   → No contiene? → 403 Forbidden
   │
   ▼
Router handler ejecuta
```

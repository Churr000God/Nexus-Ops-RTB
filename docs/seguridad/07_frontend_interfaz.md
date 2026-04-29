# Frontend — Interfaz del Módulo de Seguridad

---

## Arquitectura frontend

```
src/
├── stores/
│   └── authStore.ts          ← Zustand store principal (estado global de auth)
├── hooks/
│   └── useAuth.ts            ← Hook de acceso al store
├── services/
│   ├── authService.ts        ← Llamadas HTTP a /api/auth/*
│   └── cuentaService.ts      ← Llamadas HTTP a /api/auth/me/* (perfil, sesiones)
├── types/
│   └── cuenta.ts             ← Tipos TypeScript para Mi Cuenta
├── pages/
│   ├── Login.tsx             ← Página de inicio de sesión
│   ├── ForgotPassword.tsx    ← Solicitud de reset
│   ├── ResetPassword.tsx     ← Establecer nueva contraseña
│   ├── SetupTwoFa.tsx        ← Configurar TOTP (primera vez)
│   ├── VerifyTwoFa.tsx       ← Verificar TOTP (cada login)
│   ├── cuenta/
│   │   ├── PerfilPage.tsx    ← Editar nombre, ver roles
│   │   ├── PasswordPage.tsx  ← Cambiar contraseña propia
│   │   └── SesionesPage.tsx  ← Gestión de sesiones activas
│   └── admin/
│       ├── AdminUsuarios.tsx ← CRUD de usuarios (solo admins)
│       ├── RolesPage.tsx     ← Gestión de roles y permisos
│       └── AdminAuditLog.tsx ← Bitácora de auditoría
└── routes.tsx                ← Definición de rutas y guards
```

---

## AuthStore (Zustand)

Archivo: `src/stores/authStore.ts`

### Estado

```typescript
type AuthStatus = "booting" | "anonymous" | "authenticated" | "mfa_setup" | "mfa_verify"

type AuthState = {
  status: AuthStatus       // Estado actual del flujo de auth
  accessToken: string | null
  user: User | null
  error: string | null
  mfaToken: string | null  // Token mfa_pending (NO persiste en localStorage)
  mfaConfigured: boolean   // Si el usuario ya tiene TOTP configurado
}
```

### Persistencia (localStorage)

Solo `accessToken` y `user` se persisten. El `mfaToken` se excluye intencionalmente porque tiene TTL de 5 min:

```typescript
partialize: (state) => ({ accessToken: state.accessToken, user: state.user })
```

### Acciones

| Acción | Descripción |
|--------|-------------|
| `bootstrap()` | Valida token existente o intenta refresh. Transición booting → authenticated/anonymous |
| `login(payload)` | POST /login → guarda mfaToken → status = mfa_setup o mfa_verify |
| `logout()` | POST /logout → limpia todo el estado |
| `completeMfaSetup()` | POST /totp/setup → retorna { secret, qr_uri } |
| `confirmMfaSetup(code)` | POST /totp/setup/confirm → retorna backup_codes[], status = authenticated |
| `completeMfaVerify(code)` | POST /totp/verify → status = authenticated |
| `clearError()` | Limpia `error` |

### Diagrama de estados

```
booting
  ├─ token válido en localStorage → authenticated
  ├─ refresh cookie válida → authenticated
  └─ sin tokens → anonymous

anonymous
  └─ login() → mfa_setup | mfa_verify

mfa_setup
  └─ confirmMfaSetup() → authenticated

mfa_verify
  └─ completeMfaVerify() → authenticated

authenticated
  └─ logout() → anonymous
```

---

## Hook `useAuth`

Archivo: `src/hooks/useAuth.ts`

Expone el store completo con una API limpia:

```typescript
const {
  status,           // AuthStatus
  user,             // User | null
  error,            // string | null
  mfaToken,         // string | null
  mfaConfigured,    // boolean
  isAuthenticated,  // shorthand: status === "authenticated"
  bootstrap,
  login,
  logout,
  clearError,
  completeMfaSetup,
  confirmMfaSetup,
  completeMfaVerify,
} = useAuth()
```

---

## Rutas y guards

Archivo: `src/routes.tsx`

### Rutas públicas (sin auth)

```tsx
<Route path="/login"          element={<LoginPage />} />
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password"  element={<ResetPasswordPage />} />
<Route path="/setup-2fa"       element={<SetupTwoFaPage />} />
<Route path="/verify-2fa"      element={<VerifyTwoFaPage />} />
```

### Guard `RequireAuth`

```tsx
function RequireAuth() {
  const { status, isAuthenticated } = useAuth()

  if (status === "booting") return <LoadingCard />
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} />

  return <Outlet />
}
```

Si `status === "booting"`, muestra un card de "Cargando... Validando sesión." para evitar un flash de redirect mientras el bootstrap carga.

### Redirección post-login

```typescript
// En Login.tsx
const redirectTo = location.state?.from ?? "/"
// Tras autenticarse: navigate(redirectTo, { replace: true })
```

---

## Páginas de autenticación

### Login (`/login`)

**Diseño**: dark theme — fondo `#0f1115`, card `#1a1d21`, botón azul `blue-600`.

**Elementos:**
- Logo RTB (icono de rayo) en card azul translúcido
- Campo email con autoComplete="email"
- Campo password con autoComplete="current-password"
- Link "¿Olvidaste tu contraseña?" → `/forgot-password`
- Botón "Entrar" / "Verificando…"
- Mensaje de éxito (ej. tras reset de contraseña) con banner verde emerald
- Mensaje de error con banner rojo

**Lógica de redirección MFA:**
```typescript
useEffect(() => {
  if (status === "mfa_setup")   navigate("/setup-2fa", { replace: true })
  if (status === "mfa_verify")  navigate("/verify-2fa", { replace: true })
}, [status])
```

---

### Setup TOTP (`/setup-2fa`)

**Flujo de 2 pantallas:**

**Pantalla 1 — Escanear QR:**
- Spinner mientras carga el QR (llama a `completeMfaSetup()` al montar)
- QR renderizado con `<QRCode value={qr_uri} size={180} />` sobre fondo blanco
- Secret en texto monoespaciado para entrada manual
- Input numérico (6 dígitos) para confirmar el setup
- Botón "Activar autenticación" (deshabilitado mientras `code.length < 6`)

**Pantalla 2 — Backup codes:**
- Banner ámbar advirtiendo que los códigos se muestran una sola vez
- Grid 2 columnas con 8 códigos en fuente monoespaciada verde emerald
- Botón "Copiar todos los códigos" (con feedback "Copiado" 2s)
- Botón "Entrar al sistema" → navigate("/")

**Guard:** si `mfaToken === null` → navigate("/login") al montar (el usuario perdió el token o recargó la página).

---

### Verify TOTP (`/verify-2fa`)

**Elementos:**
- Input de 6 dígitos con `inputMode="numeric"`, monoespaciado, centrado
- **Auto-submit** al completar los 6 dígitos (sin necesidad de pulsar Enter/botón)
- Texto "El código se enviará automáticamente al completar los 6 dígitos"
- Toggle al pie: "Usar código de respaldo" ↔ "Usar código de la app autenticadora"
  - En modo backup: input de texto libre (uppercase), formato `XXXX-XXXX`
  - En modo backup: no hay auto-submit (el usuario pulsa el botón)
- Mensajes de error en banner rojo

**Guard:** si `mfaToken === null` → navigate("/login").

---

### Forgot Password (`/forgot-password`)

- Campo email
- Al enviar: `POST /api/auth/forgot-password` → siempre muestra mensaje de éxito (incluso si el email no existe, por seguridad)
- Link "Volver a login"

---

### Reset Password (`/reset-password?token=...`)

- Lee el token del query string
- Campos nueva contraseña + confirmar contraseña (validación de coincidencia en frontend)
- Al enviar: `POST /api/auth/reset-password`
- Éxito → navigate("/login", { state: { message: "Contraseña actualizada..." } })

---

## Páginas Mi Cuenta

### Perfil (`/cuenta/perfil`)

- Muestra email (no editable), nombre completo (editable), rol legacy, roles RBAC como badges
- Fecha de último acceso formateada con `formatIsoDateTime` (es-MX)
- Formulario inline: `PATCH /api/auth/me { full_name }`
- Botón "Guardar cambios" con estado de carga

### Contraseña (`/cuenta/password`)

- Campos: contraseña actual, nueva contraseña, confirmar nueva contraseña
- Validación frontend: nueva ≥ 10 chars, contiene letra y número, confirmación coincide
- `POST /api/auth/me/password`
- Éxito → `logout()` + navigate("/login") con mensaje "Contraseña actualizada. Inicia sesión de nuevo."

### Sesiones (`/cuenta/sesiones`)

- Lista de sesiones activas (tarjetas)
- Cada tarjeta muestra:
  - Icono según dispositivo detectado (desktop/mobile/tablet)
  - Sistema operativo y navegador (parseado del user_agent)
  - IP address
  - "Sesión actual" badge si `is_current: true`
  - Fecha de creación y último uso
  - Botón "Revocar" (oculto en sesión actual)
- Botón global "Cerrar todas las demás" → `DELETE /api/auth/me/sessions`
- Parsing de device info via regex en user_agent

---

## Panel Admin

### Usuarios (`/admin/usuarios`)

- Tabla de usuarios con búsqueda/filtro
- Botones: Nuevo usuario, Editar, Toggle activo/inactivo
- `CreateUserModal` — email, nombre, contraseña, rol legacy
- `EditUserModal` — email, nombre, toggle is_active, sección de cambio de contraseña (solo visible si `currentUser.role === "admin"` y el usuario objetivo no es admin)
- `RoleModal` — asignar/revocar roles RBAC con multiselect

### Roles y Permisos (`/admin/roles`)

- `RoleCard` expandible por rol
- Al expandir: grid de 70 permisos en 24 grupos con checkboxes
- `EditPermissionsModal` — toggle por permiso, toggle de grupo (indeterminate state), botón Guardar deshabilitado si no hay cambios
- `CreateRoleModal` — nombre, código, descripción, multiselect de permisos
- Rol ADMIN: sin botón de edición (protegido)

### Bitácora de Auditoría (`/admin/audit-log`)

- Tabla paginada con filtros:
  - Tipo de entidad (users, user_roles, role_permissions)
  - Rango de fechas
  - ID de usuario
- Columnas: timestamp, usuario, tabla, entidad, acción (INSERT/UPDATE/DELETE)
- Expansión de fila → diff JSON antes/después

---

## Servicios HTTP

### `authService.ts`

```typescript
authService.login(payload)                    // POST /api/auth/login
authService.refresh()                         // POST /api/auth/refresh
authService.logout()                          // POST /api/auth/logout
authService.me(token)                         // GET /api/auth/me
authService.forgotPassword(email)             // POST /api/auth/forgot-password
authService.resetPassword(token, newPassword) // POST /api/auth/reset-password
authService.getTotpSetup(mfaToken)            // POST /api/auth/totp/setup
authService.confirmTotpSetup(mfaToken, code)  // POST /api/auth/totp/setup/confirm
authService.verifyTotp(mfaToken, code)        // POST /api/auth/totp/verify
```

### `cuentaService.ts`

```typescript
cuentaService.updateProfile(token, data)         // PATCH /api/auth/me
cuentaService.changeOwnPassword(token, data)     // POST /api/auth/me/password
cuentaService.listSessions(token)                // GET /api/auth/me/sessions
cuentaService.revokeSession(token, sessionId)    // DELETE /api/auth/me/sessions/{id}
cuentaService.revokeAllOtherSessions(token)      // DELETE /api/auth/me/sessions
```

### `requestJson` wrapper (`src/lib/http.ts`)

Función centralizada para todas las peticiones HTTP del frontend:
- Agrega `Authorization: Bearer <token>` cuando se proporciona `token`
- Lanza `ApiError` con el mensaje de error de la API en errores 4xx/5xx
- Maneja JSON serialization/deserialization

---

## Variables de entorno relevantes (backend)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `JWT_SECRET` | — | Secreto para firmar JWT (obligatorio) |
| `JWT_ALGORITHM` | `HS256` | Algoritmo JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | TTL del access token |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | TTL del refresh token |
| `COOKIE_REFRESH_NAME` | `refresh_token` | Nombre de la cookie HttpOnly |
| `MAILERSEND_API_TOKEN` | — | Token de MailerSend para emails |
| `MAILERSEND_FROM_EMAIL` | `noreply@refacrtb.com.mx` | Remitente de emails |
| `FRONTEND_URL` | `http://localhost:5173` | Base URL para links en emails |
| `ALLOWED_ORIGINS` | (auto en dev) | Orígenes CORS permitidos |

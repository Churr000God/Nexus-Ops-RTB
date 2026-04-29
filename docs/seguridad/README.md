# Módulo de Seguridad — Nexus Ops RTB

Documentación técnica completa del módulo de autenticación, autorización, roles, permisos y auditoría del sistema Nexus Ops RTB.

---

## Índice

| Archivo | Contenido |
|---------|-----------|
| [01_arquitectura_y_tecnologias.md](01_arquitectura_y_tecnologias.md) | Stack tecnológico, diagrama de arquitectura, flujos de alto nivel |
| [02_base_de_datos.md](02_base_de_datos.md) | Esquema completo de BD: tablas, columnas, índices, triggers, migraciones |
| [03_autenticacion_y_tokens.md](03_autenticacion_y_tokens.md) | Flujo de login, JWT, refresh tokens, sesiones multi-dispositivo, reset de contraseña |
| [04_totp_2fa.md](04_totp_2fa.md) | Autenticación de dos factores: flujo, QR, códigos de respaldo, token mfa_pending |
| [05_rbac_roles_permisos.md](05_rbac_roles_permisos.md) | Sistema RBAC: roles, permisos atómicos, asignación, guards en backend |
| [06_api_referencia.md](06_api_referencia.md) | Referencia completa de endpoints: `/api/auth`, `/api/usuarios`, `/api/admin` |
| [07_frontend_interfaz.md](07_frontend_interfaz.md) | Páginas, componentes, store Zustand, hooks y servicios del frontend |

---

## Resumen ejecutivo

El módulo de seguridad implementa tres capas de protección:

1. **Autenticación** — Email + contraseña → TOTP obligatorio → JWT de acceso (30 min) + cookie HttpOnly de refresco (7 días).
2. **Autorización RBAC** — Permisos atómicos (`quote.create`, `cfdi.issue`…) embebidos en el JWT. Guards en cada endpoint verifican el permiso requerido.
3. **Auditoría** — Trigger PostgreSQL `fn_audit_changes` registra INSERT/UPDATE/DELETE en tablas críticas de seguridad, con snapshot JSONB antes/después.

### Flujo de login resumido

```
POST /api/auth/login
  → { mfa_token, totp_configured }
        │
        ├─ totp_configured: false → POST /api/auth/totp/setup
        │                           POST /api/auth/totp/setup/confirm
        │                            → { access_token, backup_codes } + refresh_cookie
        │
        └─ totp_configured: true  → POST /api/auth/totp/verify
                                     → { access_token } + refresh_cookie
```

### Estado de las migraciones

| Migración | Descripción |
|-----------|-------------|
| `20260428_0010` | RBAC base: roles, permissions, role_permissions, user_roles, audit_log, trigger fn_audit_changes |
| `20260428_0011` | Seed completo: 7 roles, 70 permisos, matriz de asignación |
| `20260429_0025` | Multi-sesión: DROP UNIQUE(user_id), ADD user_agent / ip_address / last_used_at a refresh_tokens |
| `20260429_0026` | Tabla password_reset_tokens para flujo forgot-password |
| `20260429_0027` | TOTP: ADD totp_secret/totp_enabled/totp_setup_at a users; CREATE totp_backup_codes |

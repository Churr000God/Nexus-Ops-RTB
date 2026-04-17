# Seguridad y Autenticación

**Propósito:** Definir cómo se protege el acceso a la plataforma, el modelo de usuarios y roles, y la configuración del Cloudflare Tunnel + red local.

---

## 1. Modelo de Acceso

La plataforma solo debe ser accesible desde:
1. **Red WiFi local** del negocio (subredes privadas).
2. **Cloudflare Tunnel** (acceso remoto autorizado) con Access Policy.

Cualquier intento desde fuera de estas fuentes es rechazado por el reverse proxy (Nginx con `allow`/`deny`).

---

## 2. Autenticación de Usuarios

### 2.1 JWT + Refresh Tokens
- **Access token:** JWT firmado HS256, exp 30 min.
- **Refresh token:** JWT o token opaco en DB, exp 7 días.
- Almacenamiento del access token: `memory` (React state / zustand), **no** en localStorage.
- Refresh token: cookie `HttpOnly; Secure; SameSite=Strict`.

### 2.2 Endpoints
```
POST /api/auth/login       { email, password } → { access, refresh }
POST /api/auth/refresh     cookie refresh       → { access }
POST /api/auth/logout      invalida refresh
GET  /api/auth/me          datos del usuario
```

### 2.3 Hash de contraseñas
- `passlib[bcrypt]` con rounds=12.
- Política de contraseña: mínimo 10 caracteres, al menos 1 letra y 1 número.

---

## 3. Roles y Permisos

| Rol | Descripción | Puede |
|-----|-------------|-------|
| `admin` | Superusuario | Todo + crear usuarios + disparar automatizaciones + ver logs del sistema |
| `operativo` | Uso diario | Ver dashboards, filtros, generar reportes, disparar actualizaciones |
| `lectura` | Solo consulta | Ver dashboards y exportar CSV; no genera reportes ni dispara flujos |

Decorador de dependencia en FastAPI:
```python
from fastapi import Depends, HTTPException
from app.dependencies import get_current_user

def require_roles(*roles: str):
    def dep(user = Depends(get_current_user)):
        if user.rol not in roles:
            raise HTTPException(403, "Forbidden")
        return user
    return dep
```

Uso:
```python
@router.post("/trigger/{area}")
async def trigger(area: str, user = Depends(require_roles("admin", "operativo"))):
    ...
```

---

## 4. Cloudflare Tunnel

### 4.1 Configuración (`cloudflare_tunnel.yml`)
```yaml
tunnel: nexus-ops-rtb
credentials-file: /etc/cloudflared/credentials.json

ingress:
  - hostname: nexus-ops.example.com
    service: http://proxy:80
    originRequest:
      noTLSVerify: false
      httpHostHeader: nexus-ops.local
  - service: http_status:404
```

### 4.2 Acceso
- Dominio: `nexus-ops.example.com` (ejemplo).
- Protegido por **Cloudflare Access** (no solo tunnel):
  - Policy: email equals `@tudominio.com` o lista explícita.
  - 2FA obligatorio.
- El backend revalida el header `Cf-Access-Jwt-Assertion` si está presente (defense in depth).

### 4.3 Estado del Túnel
- Backend expone `GET /api/system/tunnel-status` que ejecuta `cloudflared tunnel info nexus-ops-rtb` y parsea el output.
- Frontend muestra badge en header (verde/ámbar/rojo).

---

## 5. Restricción de Red (Nginx)

```nginx
# dev
allow 192.168.0.0/16;
allow 10.0.0.0/8;
deny all;

# prod con túnel
# Las IPs de Cloudflare se listan en un include separado:
include /etc/nginx/cloudflare-ips.conf;
allow 192.168.0.0/16;
deny all;
```

Se refresca la lista de IPs de Cloudflare con un cron (`scripts/update-cf-ips.sh`).

---

## 6. Headers de Seguridad

Nginx añade:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Content-Security-Policy: default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 7. CORS

En backend (`main.py`):
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Producción: solo el dominio del frontend. Nada de `*`.

---

## 8. Rate Limiting

Opciones:
1. **Nginx** con `limit_req_zone` — simple y efectivo para fuerza bruta en `/login`.
2. **slowapi** dentro de FastAPI para rate limiting por usuario.

Ejemplo Nginx:
```nginx
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
location /api/auth/login {
    limit_req zone=login burst=3 nodelay;
    proxy_pass http://backend;
}
```

---

## 9. Secretos

- **`.env`** nunca se commitea (listado en `.gitignore`).
- Se genera desde `.env.example`.
- En servidor se puede usar `docker secrets` o `pass` (password-store).
- Rotación de `JWT_SECRET`, `N8N_WEBHOOK_TOKEN` cada 90 días (script `scripts/rotate-secrets.sh`).

---

## 10. Logging de Seguridad

- Cada login exitoso / fallido se registra (usuario, IP, user-agent).
- Intentos fallidos consecutivos (>5) → bloqueo temporal de cuenta (15 min).
- Operaciones sensibles (crear usuario, disparar flujo, generar reporte) auditadas en tabla `audit_log`.

Tabla sugerida:
```
audit_log(id, user_id, accion, recurso, metadata_json, ip, user_agent, creado)
```

---

## 11. Manejo de Errores y Evitar Leaks

- Respuestas 401/403 genéricas: no distinguir "usuario no existe" vs "contraseña inválida".
- Stack traces **nunca** se exponen en producción (`ENV=production` desactiva `/docs` y detalles).
- Pydantic `ValidationError` se traduce a 422 con mensaje limpio.

---

## 12. Checklist de Seguridad Pre-Producción

- [ ] `.env` no está en git.
- [ ] `JWT_SECRET` aleatorio de ≥ 32 bytes.
- [ ] `/docs` y `/redoc` desactivados en prod.
- [ ] TLS habilitado (cert local o Cloudflare origin).
- [ ] Access Policy en Cloudflare configurada.
- [ ] Rate limiting en `/login`.
- [ ] Headers de seguridad en Nginx.
- [ ] Backups nocturnos funcionando.
- [ ] Usuarios con contraseñas fuertes, 2FA donde aplique.
- [ ] Rol mínimo necesario asignado a cada cuenta.
- [ ] Logs rotados (logrotate o Loguru con rotation).

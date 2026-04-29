# TOTP — Autenticación de Dos Factores

La autenticación de dos factores es **obligatoria** para todos los usuarios del sistema. No existe ningún flujo que permita acceder con solo contraseña.

---

## Fundamentos técnicos

### TOTP (Time-based One-Time Password)

- Estándar **RFC 6238** implementado por Google Authenticator, Microsoft Authenticator, Authy, Bitwarden, etc.
- Genera un código de **6 dígitos** que cambia cada **30 segundos**
- Basado en HMAC-SHA1 sobre `(secret_key, floor(unix_timestamp / 30))`
- `valid_window=1` en la implementación: acepta el código del período actual y del anterior (tolerancia de ±30s de desfase de reloj)

### Librería

```python
import pyotp  # versión 2.9.0

# Generar clave
secret = pyotp.random_base32()  # 32 caracteres Base32, ej. "U37TCMG7LP3GKFJINWKVLEF5XERSKYGJ"

# Generar URI para QR
totp = pyotp.TOTP(secret)
uri = totp.provisioning_uri(name="usuario@empresa.com", issuer_name="Nexus Ops RTB")
# otpauth://totp/Nexus%20Ops%20RTB:usuario%40empresa.com?secret=...&issuer=Nexus%20Ops%20RTB

# Verificar código
totp.verify("123456", valid_window=1)  # → True / False
```

---

## Token `mfa_pending`

El token MFA es un JWT especial de corta duración que sirve como "challenge" entre el login y la verificación 2FA. Es la pieza central del flujo.

```
POST /api/auth/login
→ retorna mfa_token (JWT con type="mfa_pending", TTL=5min)

El mfa_token se envía como:
  Authorization: Bearer <mfa_token>
  en los endpoints /api/auth/totp/*
```

**Seguridad del mfa_token:**
- Firmado con el mismo `JWT_SECRET` que los access tokens
- Rechazado explícitamente en `get_current_user`:
  ```python
  if token_payload.get("type") == "mfa_pending":
      raise HTTPException(401, "No autenticado")
  ```
- Solo aceptado por `require_mfa_challenge`:
  ```python
  if token_payload.get("type") != "mfa_pending":
      raise HTTPException(401, "MFA challenge requerido")
  ```
- No persiste en localStorage (excluido del `partialize` de Zustand → se pierde al recargar → el usuario debe hacer login de nuevo)

---

## Flujo: primera vez (setup)

Aplica cuando `totp_configured: false` en la respuesta de login.

```
Paso 1 — Login
POST /api/auth/login { email, password }
← { mfa_token: "eyJ...", totp_configured: false }

Frontend: status = "mfa_setup" → navigate("/setup-2fa")

─────────────────────────────────────────

Paso 2 — Obtener QR y clave
POST /api/auth/totp/setup
Authorization: Bearer <mfa_token>

Backend:
  - require_mfa_challenge verifica type == "mfa_pending"
  - pyotp.random_base32() genera clave nueva
  - UPDATE users SET totp_secret = <secret>  (totp_enabled sigue FALSE)
← { secret: "U37TCMG7...", qr_uri: "otpauth://totp/..." }

Frontend:
  - Renderiza <QRCode value={qr_uri} /> con react-qr-code
  - Muestra el secret en texto plano para entrada manual
  - El usuario escanea el QR con su app autenticadora

─────────────────────────────────────────

Paso 3 — Confirmar setup con primer código
POST /api/auth/totp/setup/confirm
Authorization: Bearer <mfa_token>
{ code: "123456" }

Backend:
  - require_mfa_challenge
  - pyotp.TOTP(user.totp_secret).verify(code, valid_window=1)
    → Si falla: 400 "Código incorrecto — verifica la hora de tu dispositivo"
    → Si OK:
      UPDATE users SET totp_enabled=TRUE, totp_setup_at=now()
      DELETE totp_backup_codes WHERE user_id = ?  (limpia anteriores si los hay)
      Genera 8 backup codes:
        secrets.token_hex(4).upper() + "-" + secrets.token_hex(4).upper()
        → "A3F2-8C91", "B047-D1E5", ...
      INSERT totp_backup_codes con SHA-256(code) para cada uno
      create_access_token(user, permissions)
      issue_refresh_token(user_id, user_agent, ip_address)
← { access_token: "eyJ...", backup_codes: ["A3F2-8C91", ...] }
   Set-Cookie: refresh_token=...

Frontend:
  - Muestra pantalla de backup codes (SOLO UNA VEZ)
  - Botón "Copiar todos" → navigator.clipboard.writeText(codes.join("\n"))
  - Botón "Entrar al sistema" → navigate("/")
  - status = "authenticated"
```

---

## Flujo: login recurrente (verify)

Aplica cuando `totp_configured: true` (el usuario ya configuró TOTP antes).

```
POST /api/auth/login { email, password }
← { mfa_token: "eyJ...", totp_configured: true }

Frontend: status = "mfa_verify" → navigate("/verify-2fa")

─────────────────────────────────────────

POST /api/auth/totp/verify
Authorization: Bearer <mfa_token>
{ code: "654321" }  ← código de app autenticadora O código de respaldo

Backend:
  - require_mfa_challenge
  - verify_totp_code(user, code):
      1. pyotp.TOTP.verify(code.strip(), valid_window=1) → si True → OK
      2. Si no: busca code.strip().upper() en totp_backup_codes
         WHERE code_hash = SHA-256(normalized) AND used_at IS NULL
         → Si encontrado: UPDATE used_at = now() → OK
      3. Si ninguno: retorna False → 400 "Código incorrecto"
  - Si OK:
      create_access_token(user, permissions)
      issue_refresh_token(user_id, user_agent, ip_address)
← { access_token: "eyJ..." }
   Set-Cookie: refresh_token=...

Frontend:
  - navigate("/") 
  - status = "authenticated"
```

---

## Códigos de respaldo

### Generación

```python
backup_codes = [
    secrets.token_hex(4).upper() + "-" + secrets.token_hex(4).upper()
    for _ in range(8)
]
# Ejemplo: ["A3F2-8C91", "7B0D-E452", "C19F-3A87", ...]
```

### Almacenamiento

Solo el hash SHA-256 del código (normalizado a uppercase) se guarda en BD. El código crudo nunca persiste.

```python
code_hash = hashlib.sha256(raw_code.upper().encode("utf-8")).hexdigest()
```

### Uso

- El usuario ingresa el código en formato `XXXX-XXXX`
- El frontend normaliza a uppercase
- Se envía como `{ code: "A3F2-8C91" }` a `POST /api/auth/totp/verify`
- El backend calcula SHA-256 y busca en `totp_backup_codes WHERE used_at IS NULL`
- Si se encuentra: se marca `used_at = now()` y se procede
- Cada código es de **un solo uso** — tras usarse no puede volver a usarse

### Regeneración

Actualmente los backup codes se regeneran únicamente al volver a hacer el setup de TOTP (migración: el endpoint `totp/setup/confirm` hace DELETE de todos los anteriores antes de insertar los nuevos). No existe un endpoint dedicado para regenerar backup codes sin reconfigurar TOTP.

---

## Casos de error comunes

| Situación | Error | Causa probable |
|-----------|-------|----------------|
| Código de 6 dígitos incorrecto | 400 "Código incorrecto — verifica la hora de tu dispositivo" | Reloj del dispositivo desincronizado (> 30s de desfase) |
| mfa_token expirado al confirmar | 401 | El usuario tardó > 5 min en completar el setup |
| mfa_token usado en endpoint normal | 401 "No autenticado" | Se usó el mfa_token en vez del access_token |
| Código de respaldo ya usado | 400 "Código incorrecto" | El código ya se marcó como `used_at` |
| Código de respaldo en minúsculas | — | El frontend normaliza a uppercase antes de enviar |

---

## Seguridad del secret TOTP

El `totp_secret` se almacena en texto plano en la BD. Esto es una práctica estándar en implementaciones TOTP porque:
1. El secret debe poder usarse en tiempo real para verificar cada código
2. PostgreSQL en Supabase usa cifrado en tránsito y en reposo
3. El access a la BD requiere credenciales de servicio (no expuestas al usuario)

En un escenario de máxima seguridad se podría cifrar el secret con una clave maestra (AES-256), pero eso añade complejidad operacional sin beneficio proporcional en este modelo de amenaza.

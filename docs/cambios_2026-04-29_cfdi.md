# Módulo CFDI 4.0 — Implementación completa (2026-04-29)

## Contexto

Se implementó el módulo de facturación electrónica CFDI 4.0 descrito en
`Reestructuracion_Bases_Datos/14_modulo_cfdi.docx`.

Las tablas base (`cfdi`, `cfdi_items`, `cfdi_credit_notes`, `cfdi_payments`,
`payment_applications`) ya existían desde el módulo de Ventas y Logística
(migración 0015). Este módulo las extiende con columnas fiscales SAT y añade
las tablas de configuración del emisor, series de folios y log de timbrado.

Flujo completo:

```
Borrador (DRAFT) → Timbrado (TIMBRADO) → Pago (PAID) / Cancelado (CANCELLED)
         ↓
   Nota de Crédito (Tipo E)
   Complemento de Pago (Tipo P, cuando CFDI es PPD)
```

---

## Base de Datos

### Migraciones aplicadas

| Revisión | Archivo | Contenido |
|---|---|---|
| `20260429_0022` | `20260429_0022_cfdi_config_series_pac_log_ddl.py` | 3 tablas nuevas, ALTER a 3 tablas existentes, seed series, 4 permisos RBAC |
| `20260429_0023` | `20260429_0023_cfdi_funciones_vistas_triggers.py` | `fn_assign_cfdi_folio`, trigger auto-paid, 2 vistas |

### Tablas nuevas (3)

**`cfdi_issuer_config`** — Configuración del emisor (CSD + PAC).

| Campo | Tipo | Descripción |
|---|---|---|
| `config_id` | BIGINT IDENTITY PK | |
| `rfc` | VARCHAR(13) | RFC del emisor (12-13 chars) |
| `legal_name` | TEXT | Razón social |
| `tax_regime_id` | SMALLINT FK → `sat_tax_regimes` | Régimen fiscal SAT |
| `zip_code` | VARCHAR(5) | CP del lugar de expedición |
| `csd_certificate_b64` | TEXT | Certificado CSD en base64 |
| `csd_key_encrypted` | TEXT | Llave privada CSD cifrada |
| `csd_password_hash` | TEXT | Hash de contraseña del CSD |
| `csd_serial_number` | VARCHAR(40) | Número de serie del CSD |
| `csd_valid_from/to` | DATE | Vigencia del CSD |
| `pac_provider` | TEXT | `DIVERZA`, `EDICOM`, `FACTURAMA`, `STUB` |
| `pac_username` | TEXT | Credencial PAC |
| `pac_endpoint_url` | TEXT | URL de timbrado del PAC |
| `pac_credentials_enc` | TEXT | Credenciales PAC cifradas |
| `pac_environment` | TEXT DEFAULT `'SANDBOX'` | `SANDBOX` o `PRODUCTION` |
| `is_active` | BOOLEAN DEFAULT TRUE | Solo un config activo a la vez |
| `valid_from/to` | DATE | Vigencia de la configuración |
| `created_by` | UUID FK → `users.id` | |

**`cfdi_series`** — Series y folios.

| Campo | Tipo | Descripción |
|---|---|---|
| `series_id` | BIGINT IDENTITY PK | |
| `series` | VARCHAR(10) | Código de serie (A, NC, CP, EXP…) |
| `cfdi_type` | CHAR(1) | I / E / P / T |
| `description` | TEXT | Descripción de la serie |
| `next_folio` | BIGINT DEFAULT 1 | Próximo folio a asignar |
| `is_active` | BOOLEAN DEFAULT TRUE | |
| UNIQUE(`series`, `cfdi_type`) | | |

Seed inicial (migración 0022):

| Serie | Tipo | Descripción |
|---|---|---|
| A | I | Facturas de ingreso |
| NC | E | Notas de crédito |
| CP | P | Complementos de pago |
| EXP | I | Facturas exportación |

**`cfdi_pac_log`** — Bitácora inmutable de operaciones PAC (INSERT only).

| Campo | Tipo | Descripción |
|---|---|---|
| `log_id` | BIGINT IDENTITY PK | |
| `cfdi_id` | BIGINT FK → `cfdi` | |
| `operation` | VARCHAR(20) | `STAMP`, `CANCEL`, `QUERY` |
| `success` | BOOLEAN | Resultado de la operación |
| `uuid_received` | VARCHAR(36) | UUID del TFD recibido del PAC |
| `error_code` | VARCHAR(20) | Código de error SAT/PAC |
| `error_message` | TEXT | Mensaje de error |
| `pac_response` | JSONB | Respuesta completa del PAC |
| `pac_provider` | TEXT | PAC que procesó la operación |
| `user_id` | UUID FK → `users.id` | Usuario que inició la operación |
| `requested_at` | TIMESTAMPTZ DEFAULT NOW() | |

### Columnas añadidas a tablas existentes

**`cfdi`** — 16 columnas nuevas:

| Campo | Tipo | Descripción |
|---|---|---|
| `series_id` | BIGINT FK → `cfdi_series` | Serie asignada |
| `folio` | BIGINT | Folio consecutivo de la serie |
| `cfdi_version` | TEXT DEFAULT `'4.0'` | Versión del estándar SAT |
| `issuer_config_id` | BIGINT FK → `cfdi_issuer_config` | Config usada al timbrar |
| `issuer_rfc` | TEXT | Snapshot fiscal del emisor |
| `issuer_name` | TEXT | Snapshot fiscal del emisor |
| `issuer_tax_regime` | TEXT | Snapshot fiscal del emisor |
| `receiver_rfc` | TEXT | Snapshot fiscal del receptor |
| `receiver_name` | TEXT | Snapshot fiscal del receptor |
| `receiver_tax_regime` | TEXT | Snapshot fiscal del receptor |
| `receiver_zip` | TEXT | CP del receptor (obligatorio CFDI 4.0) |
| `sello_cfdi` | TEXT | Sello digital del CFDI (TFD) |
| `sello_sat` | TEXT | Sello digital del SAT (TFD) |
| `certificate_number` | TEXT | Número de serie del certificado SAT |
| `timbre_date` | TIMESTAMPTZ | Fecha/hora del timbrado |
| `xml_path` | TEXT | Ruta del XML timbrado (almacén) |
| `pdf_path` | TEXT | Ruta del PDF representación |

Constraint `cfdi_status_check` recreado con valores ampliados:
`DRAFT`, `ISSUED`, `TIMBRADO`, `PAID`, `CANCELLED`, `SUPERSEDED`

**`cfdi_items`** — 3 columnas nuevas:

| Campo | Tipo | Descripción |
|---|---|---|
| `sat_product_key_id` | UUID FK → `sat_product_keys(id)` | Clave SAT del producto (c_ClaveProdServ) |
| `sat_unit_key_id` | UUID FK → `sat_unit_keys(id)` | Clave SAT de unidad (c_ClaveUnidad) |
| `iva_pct` | NUMERIC(6,4) DEFAULT 0.16 | Porcentaje IVA (0.00–1.00) |

**`cfdi_credit_notes`** — 1 columna nueva:

| Campo | Tipo | Descripción |
|---|---|---|
| `relation_type` | VARCHAR(2) | `c_TipoRelacion` SAT (01–07) |

### Función `fn_assign_cfdi_folio(p_series TEXT)`

Asigna un folio de forma atómica usando `UPDATE … RETURNING`:

```sql
UPDATE cfdi_series
   SET next_folio = next_folio + 1
 WHERE series = p_series AND is_active = TRUE
 RETURNING series_id, next_folio - 1 INTO out_series_id, out_folio;
```

Garantiza que dos transacciones concurrentes nunca obtengan el mismo folio.

### Trigger `trg_cfdi_auto_paid`

Función: `fn_cfdi_auto_paid()`
Evento: `AFTER INSERT OR UPDATE` en `cfdi_payments`

Si `SUM(amount_paid) >= cfdi.total`, actualiza `cfdi.status = 'PAID'` automáticamente.

### Vistas

**`v_cfdi_ppd_pending_payment`** — CFDIs Tipo I con método PPD y saldo pendiente > 0.

Campos relevantes: `cfdi_id`, `uuid`, `cfdi_number`, `series_code`, `folio`,
`issue_date`, `customer_name`, `customer_rfc`, `total`, `paid_amount`,
`remaining_balance`, `days_since_issue`, `status`.

**`v_cfdi_status_summary`** — Resumen agregado de CFDIs agrupado por `cfdi_type`,
`series` y `status`. Incluye `count`, `sum_total` y `avg_total`.

### RBAC

**Nuevos permisos (4):**

| Permiso | Descripción |
|---|---|
| `cfdi.view` | Ver listados y detalle de CFDIs |
| `cfdi.issue` | Crear borradores y timbrar |
| `cfdi.cancel` | Cancelar CFDIs ante el SAT |
| `cfdi.config.manage` | Gestionar configuración del emisor y series |

Asignados al rol `Administrador` (todos los 4 permisos).

---

## Backend (FastAPI)

### Archivos nuevos

| Archivo | Descripción |
|---|---|
| `app/models/cfdi_models.py` | 3 modelos SQLAlchemy: `CfdiIssuerConfig`, `CfdiSeries`, `CfdiPacLog` |
| `app/schemas/cfdi_schemas.py` | Schemas Pydantic v2: In/Out para todos los recursos CFDI |
| `app/services/pac_client.py` | Abstracción PAC con `StubPacClient` (sandbox) y `PacClientBase` (ABC) |
| `app/services/cfdi_service.py` | Lógica completa: crear borrador, timbrar, cancelar, notas de crédito, complementos de pago, vistas |
| `app/routers/cfdi.py` | 10 endpoints bajo `/api/cfdi` |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `app/models/ventas_logistica_models.py` | `CFDI` — 16 campos nuevos; `CFDIItem` — 3 campos nuevos; `CFDICreditNote` — `relation_type`; campo `status` cambiado de `String(15)` a `Text` |
| `app/models/__init__.py` | Exporta `CfdiIssuerConfig`, `CfdiSeries`, `CfdiPacLog` |
| `app/main.py` | Registra `cfdi_router` con prefijo `/api/cfdi` |

### PAC Client (`pac_client.py`)

Patrón de abstracción para integrar PACs reales en el futuro:

```python
class PacClientBase(ABC):
    async def stamp(self, cfdi_xml, cfdi_id) -> StampResult: ...
    async def cancel(self, uuid, ...) -> CancelResult: ...

class StubPacClient(PacClientBase):
    # Genera UUID falso — para desarrollo y SANDBOX
    async def stamp(...) -> StampResult: # uuid=UUID4 generado, success=True
    async def cancel(...) -> CancelResult: # sat_status="CANCELADO", success=True

def get_pac_client(pac_provider, pac_environment) -> PacClientBase:
    if pac_provider in (None, "STUB") or pac_environment == "SANDBOX":
        return StubPacClient()
    raise NotImplementedError(f"PAC {pac_provider} no implementado")
```

Para conectar un PAC real: implementar `PacClientBase` y agregar la rama en `get_pac_client`.

### Fix crítico: colisión de rutas en FastAPI

`GET /api/cfdi/ppd-pending` colisionaba con `GET /api/cfdi/{cfdi_id}` porque
FastAPI intentaba parsear `"ppd-pending"` como `int` → 422.

Solución: todas las rutas estáticas (`/ppd-pending`, `/credit-notes`,
`/payment-complements`) se declaran **antes** de `/{cfdi_id}` en el router.

### Endpoints (10)

```
# Configuración del emisor
GET  /api/cfdi/issuer-config
POST /api/cfdi/issuer-config

# Series
GET  /api/cfdi/series

# CFDIs — rutas estáticas (ANTES de /{cfdi_id})
GET  /api/cfdi/ppd-pending
POST /api/cfdi/credit-notes
POST /api/cfdi/payment-complements

# CFDIs — CRUD
GET  /api/cfdi
POST /api/cfdi
GET  /api/cfdi/{cfdi_id}

# Operaciones sobre un CFDI
POST /api/cfdi/{cfdi_id}/stamp
POST /api/cfdi/{cfdi_id}/cancel
GET  /api/cfdi/{cfdi_id}/pac-log
```

### Permisos requeridos por endpoint

| Endpoints | Permiso |
|---|---|
| `GET /issuer-config`, `GET /series`, `GET /`, `GET /{id}`, `GET /ppd-pending`, `GET /{id}/pac-log` | `cfdi.view` |
| `POST /`, `POST /credit-notes`, `POST /payment-complements`, `POST /{id}/stamp` | `cfdi.issue` |
| `POST /{id}/cancel` | `cfdi.cancel` |
| `POST /issuer-config` | `cfdi.config.manage` |

---

## Frontend (React + TypeScript)

### Archivos nuevos

| Archivo | Descripción |
|---|---|
| `src/types/cfdi.ts` | Interfaces TypeScript para todos los recursos CFDI |
| `src/services/cfdiService.ts` | Funciones de API client para los 8 endpoints públicos |
| `src/pages/CfdiPage.tsx` | Página principal con 4 pestañas |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/routes.tsx` | Import `CfdiPage` + `<Route path="cfdi" element={<CfdiPage />} />` |
| `src/components/layout/Sidebar.tsx` | Sección "Facturación" con link `/cfdi` (icono `Stamp`) |
| `src/components/layout/AppShell.tsx` | Título y subtítulo para la ruta `/cfdi` |

### Estructura de CfdiPage (4 pestañas)

**Facturas** — Lista todos los CFDIs. Filtros: estatus (DRAFT/ISSUED/TIMBRADO/PAID/CANCELLED/SUPERSEDED) y tipo (I/E/P/T). KPIs: total facturado, timbrados/pagados, borradores.

**Complementos de Pago** — Lista CFDIs PPD con saldo pendiente (`v_cfdi_ppd_pending_payment`). KPIs: cantidad de CFDIs pendientes y saldo total pendiente (destacado en ámbar).

**Notas de Crédito** — Lista CFDIs de tipo E (filtro automático `cfdi_type=E`).

**Configuración** — Muestra la configuración del emisor activa (RFC, razón social, PAC, vigencia del CSD). Solo lectura.

### Rutas registradas

| Ruta | Componente |
|---|---|
| `/cfdi` | `CfdiPage` |

---

## Script de inicialización (`scripts/init-dev.ps1`)

Script PowerShell nuevo para Windows. Automatiza el arranque completo del entorno de desarrollo:

1. Verifica `.env` (copia desde `.env.example` si no existe)
2. Abre el relay de Supabase en ventana separada si el puerto 5433 está cerrado
3. Levanta `redis` y `backend` con Docker Compose y espera `/health`
4. Aplica migraciones pendientes: `alembic upgrade head`
5. Opcionalmente levanta `frontend` (flag `-WithFrontend`)

```powershell
# Uso típico
.\scripts\init-dev.ps1

# Con frontend
.\scripts\init-dev.ps1 -WithFrontend

# Saltar relay si ya está corriendo
.\scripts\init-dev.ps1 -SkipRelay
```

`scripts/init-project.sh` actualizado para detectar `pwsh` y delegar a `init-dev.ps1`.

---

## Notas de despliegue

```bash
# Aplicar migraciones (0022 y 0023):
docker compose exec backend alembic upgrade head

# Rebuild seguro:
docker compose up -d --build backend frontend
```

### Smoke test (post-deploy)

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dhguilleng@gmail.com","password":"..."}' | jq -r '.access_token')

# Series disponibles
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/cfdi/series

# CFDIs PPD pendientes
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/cfdi/ppd-pending

# Crear borrador
curl -s -X POST http://localhost:8000/api/cfdi \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"cfdi_number":"F-001","series":"A","customer_id":1,"issue_date":"2026-04-29",
       "payment_method":"PUE","payment_form":"03","cfdi_use":"G01",
       "items":[{"description":"Servicio","quantity":1,"unit_price":1000}]}'

# Timbrar (CFDI id=1)
curl -s -X POST http://localhost:8000/api/cfdi/1/stamp \
  -H "Authorization: Bearer $TOKEN"
# → uuid, status=TIMBRADO ✓
```

Resultado verificado en sesión de implementación:
- Series: 4 series activas (A/I, NC/E, CP/P, EXP/I) ✓
- PPD pending: 0 (sin datos) ✓
- Crear borrador: cfdi_id=1, folio=1, total=1160.00 ✓
- Timbrar: UUID=FEAC7361-4FA1-48D2-A97E-77CF5024CFB9, status=TIMBRADO ✓

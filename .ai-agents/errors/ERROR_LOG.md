# Registro de Errores y Soluciones

**Proposito:** Documentar cada error encontrado durante el desarrollo para evitar repetirlos y construir una base de soluciones.

---

## Como Registrar un Error

1. Asignar un ID secuencial: `ERR-0001`, `ERR-0002`, etc.
2. Crear un archivo en `resolutions/` con el formato: `ERR-XXXX_descripcion-breve.md`
3. Agregar la entrada al indice de abajo.

### Plantilla de Error

```markdown
# ERR-XXXX: [Titulo del error]

**Fecha:** YYYY-MM-DD
**Area:** [backend|frontend|docker|n8n|db|scripts|general]
**Severidad:** [critico|alto|medio|bajo]
**Estado:** [resuelto|pendiente|workaround]

## Descripcion
Que paso exactamente. Incluir mensaje de error completo.

## Contexto
Que se estaba haciendo cuando ocurrio. Que archivos estaban involucrados.

## Causa Raiz
Por que ocurrio. Que condicion lo provoco.

## Solucion
Paso a paso de como se resolvio.

## Prevencion
Que hacer para evitar que vuelva a ocurrir.

## Archivos Afectados
- `ruta/archivo.py` — que se cambio

## Referencias
- Links a docs, Stack Overflow, issues, etc.
```

---

## Indice de Errores

| ID | Fecha | Area | Severidad | Titulo | Estado | Archivo |
|----|-------|------|-----------|--------|--------|---------|
| ERR-0001 | 2026-04-18 | backend | medio | Pydantic Settings no parsea ALLOWED_ORIGINS desde env | resuelto | [ERR-0001_pydantic-settings-allowed-origins.md](resolutions/ERR-0001_pydantic-settings-allowed-origins.md) |
| ERR-0002 | 2026-04-18 | backend | alto | passlib/bcrypt incompatible (bcrypt 5.x) rompe hashing | resuelto | [ERR-0002_passlib-bcrypt-incompatible.md](resolutions/ERR-0002_passlib-bcrypt-incompatible.md) |
| ERR-0003 | 2026-04-18 | backend | medio | Logout devuelve status_code None y rompe respuesta | resuelto | [ERR-0003_logout-status-code-none.md](resolutions/ERR-0003_logout-status-code-none.md) |
| ERR-0004 | 2026-04-21 | backend | alto | CORS 500 en /at-risk-customers: datetime con tz no convierte a date + customer_name NULL | resuelto | [ERR-0004_at-risk-customers-datetime-null-name.md](resolutions/ERR-0004_at-risk-customers-datetime-null-name.md) |
| ERR-0005 | 2026-04-21 | db | alto | setup-db.sh falla: DuplicateTable staging.csv_files — alembic_version perdida | resuelto | [ERR-0005_alembic-version-missing-staging-tables-orphaned.md](resolutions/ERR-0005_alembic-version-missing-staging-tables-orphaned.md) |
| ERR-0006 | 2026-04-21 | frontend | bajo | docker build frontend falla: TS2322 string\|null no asignable a string\|undefined en VentasDashboard | resuelto | [ERR-0006_ts-null-vs-undefined-ventasdashboard.md](resolutions/ERR-0006_ts-null-vs-undefined-ventasdashboard.md) |
| ERR-0007 | 2026-04-21 | backend | bajo | ruff F821: Undefined name RecentQuoteResponse en app/routers/ventas.py | resuelto | [ERR-0007_ruff-f821-recentquoteresponse.md](resolutions/ERR-0007_ruff-f821-recentquoteresponse.md) |
| ERR-0008 | 2026-04-21 | backend | alto | ModuleNotFoundError: No module named 'app' en subprocess de sync_csv_data.py | resuelto | [ERR-0008_subprocess-pythonpath-modulo-app.md](resolutions/ERR-0008_subprocess-pythonpath-modulo-app.md) |
| ERR-0009 | 2026-04-21 | n8n | medio | n8n envia "filesystem-v2" en lugar del contenido base64 del CSV | resuelto | [ERR-0009_n8n-filesystem-v2-en-lugar-de-base64.md](resolutions/ERR-0009_n8n-filesystem-v2-en-lugar-de-base64.md) |
| ERR-0010 | 2026-04-21 | frontend | medio | Dropdown de sugerencias de clientes se cerraba antes de registrar el click | resuelto | [ERR-0010_dropdown-sugerencias-cierra-antes-de-click.md](resolutions/ERR-0010_dropdown-sugerencias-cierra-antes-de-click.md) |
| ERR-0011 | 2026-04-21 | db | medio | PostgreSQL ORDER BY col DESC coloca NULLs primero por defecto | resuelto | [ERR-0011_postgresql-desc-nulls-first-por-defecto.md](resolutions/ERR-0011_postgresql-desc-nulls-first-por-defecto.md) |
| ERR-0012 | 2026-04-22 | frontend | bajo | TS2322 MissingDemandByProduct[] no asignable a ProductSuggestion[] en docker build | resuelto | [ERR-0012_ts2322-missingdemandbyproduct-no-asignable-productsugestion.md](resolutions/ERR-0012_ts2322-missingdemandbyproduct-no-asignable-productsugestion.md) |
| ERR-0013 | 2026-04-23 | backend | alto | AttributeError: CT_TcPr sin metodo get_or_add_shd en python-docx 1.1.2 | resuelto | [ERR-0013_python-docx-ct-tcpr-no-shd.md](resolutions/ERR-0013_python-docx-ct-tcpr-no-shd.md) |
| ERR-0014 | 2026-04-24 | backend+db | alto | Columnas GENERATED ALWAYS no declaradas con Computed() en GoodsReceipt rompen upsert | resuelto | [ERR-0014_generated-always-computed-goodsreceipt.md](resolutions/ERR-0014_generated-always-computed-goodsreceipt.md) |
| ERR-0015 | 2026-04-24 | backend+scripts | alto | ForeignKeyViolation quote_id en sync delta: cotizacion padre ausente del batch | resuelto | [ERR-0015_fk-violation-quote-id-sync-delta.md](resolutions/ERR-0015_fk-violation-quote-id-sync-delta.md) |
| ERR-0016 | 2026-04-24 | backend+db | alto | UniqueViolation proveedor_productos_pkey: conflict_cols sin constraint UNIQUE real | resuelto | [ERR-0016_unique-violation-proveedor-productos-conflict-cols.md](resolutions/ERR-0016_unique-violation-proveedor-productos-conflict-cols.md) |
| ERR-0017 | 2026-04-24 | backend+scripts | alto | Headers CSV duplicados en Bitacora: DictReader last-wins borra UUID de la primera columna | resuelto | [ERR-0017_csv-headers-duplicados-bitacora-uuid-perdido.md](resolutions/ERR-0017_csv-headers-duplicados-bitacora-uuid-perdido.md) |
| ERR-0018 | 2026-04-25 | docker | medio | ngrok se reinicia en bucle: dominio hardcodeado pertenece a otra cuenta (ERR_NGROK_320) | resuelto | [ERR-0018_ngrok-dominio-cuenta-incorrecta.md](resolutions/ERR-0018_ngrok-dominio-cuenta-incorrecta.md) |
| ERR-0019 | 2026-04-25 | docker | medio | Fix ERR-0018 reemplazó dominio de producción con el de desarrollo causando el mismo error | resuelto | [ERR-0019_ngrok-dominio-prod-reemplazado-por-dev.md](resolutions/ERR-0019_ngrok-dominio-prod-reemplazado-por-dev.md) |
| ERR-0020 | 2026-04-29 | frontend | medio | TS2322 `"neutral"` no asignable a `KpiTone` local en Inventarios.tsx rompe docker build | resuelto | [ERR-0020_ts2322-neutral-no-asignable-KpiTone-Inventarios.md](resolutions/ERR-0020_ts2322-neutral-no-asignable-KpiTone-Inventarios.md) |

---

## Estadisticas

| Metrica | Valor |
|---------|-------|
| Total errores registrados | 20 |
| Resueltos | 20 |
| Pendientes | 0 |
| Workarounds | 0 |

---

## Errores Frecuentes por Area

### Docker
_(Se llenara conforme se registren errores)_

### Backend (Python/FastAPI)
_(Se llenara conforme se registren errores)_

### Frontend (React/TypeScript)
_(Se llenara conforme se registren errores)_

### Base de Datos (PostgreSQL)
_(Se llenara conforme se registren errores)_

### n8n
_(Se llenara conforme se registren errores)_

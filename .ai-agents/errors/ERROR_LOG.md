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

---

## Estadisticas

| Metrica | Valor |
|---------|-------|
| Total errores registrados | 3 |
| Resueltos | 3 |
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

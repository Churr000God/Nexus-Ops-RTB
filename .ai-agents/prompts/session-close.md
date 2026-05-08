# Prompt: Cierre de Sesión — Nexus Ops RTB

## Instrucciones
Ejecuta el flujo completo de cierre de sesión en este orden. No pidas confirmación entre pasos salvo que haya algo destructivo.

---

## Fase 1 — Revisar qué cambió

1. Ejecuta `git status` y `git diff --stat` para ver todos los archivos modificados.
2. Ejecuta `git log --oneline -10` para ver el contexto de commits recientes.
3. Lista los archivos nuevos (`??` en git status) que aún no están trackeados.

---

## Fase 2 — Documentar cambios

### 2a. Error log
Si hubo errores durante esta sesión que valga la pena registrar:
- Revisar `.ai-agents/errors/ERROR_LOG.md`
- Agregar entradas con formato: `ERR-XXXX | fecha | descripción breve | archivo resolución`
- Crear archivo de resolución en `.ai-agents/errors/resolutions/` si aplica

### 2b. Memoria del proyecto
Actualizar o crear archivos en `C:\Users\dhgui\.claude\projects\...\memory\` para:
- Cualquier decisión técnica nueva que NO esté ya en la memoria
- Cualquier convención o patrón nuevo establecido en esta sesión
- Estado actualizado de módulos que cambiaron significativamente
- NO duplicar lo que ya está documentado en el código

### 2c. Documentación técnica
Si se creó o modificó un módulo significativo:
- Revisar si existe el archivo correspondiente en `estructura_proyecto/`
- Actualizar secciones desactualizadas (endpoints, schemas, flujos)
- Si es un módulo nuevo, crear el archivo con la estructura estándar del proyecto

---

## Fase 3 — Commit y push

1. Agrupa los cambios en commits lógicos siguiendo **Conventional Commits**:
   - `feat(módulo):` — funcionalidad nueva
   - `fix(módulo):` — corrección de bug
   - `refactor(módulo):` — refactoring sin cambio de comportamiento
   - `perf(módulo):` — mejora de rendimiento
   - `docs:` — solo documentación
   - `chore:` — mantenimiento (deps, config)

2. Para cada commit:
   - Stagea solo los archivos relevantes al cambio (NO `git add .` genérico)
   - Mensaje en español o inglés consistente con el historial del proyecto
   - Agregar al final: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

3. Después de todos los commits: `git push origin main`

---

## Fase 4 — Resumen de sesión

Al terminar, dame un resumen con este formato exacto:

```
## Sesión [fecha hoy]

### Lo que se hizo
- [bullet por cada feature/fix implementado]

### Archivos principales modificados
- [ruta/archivo.ext] — descripción del cambio

### Migraciones aplicadas
- [revision_id] — descripción (o "Ninguna" si no hubo)

### Deuda técnica pendiente
- [cualquier TODO, workaround o tarea incompleta que quedó abierta]

### Próximos pasos sugeridos
- [máximo 3 items concretos que tienen sentido continuar en la siguiente sesión]
```

---

## Atajos

- Solo commit y push → `"ejecuta solo la Fase 3"`
- Solo actualizar memoria → `"ejecuta solo la Fase 2b"`
- Solo documentación técnica → `"ejecuta solo la Fase 2c"`
- Sin push (solo commit local) → indícalo al inicio

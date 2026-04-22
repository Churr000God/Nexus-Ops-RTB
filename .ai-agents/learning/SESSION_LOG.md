# Registro de Sesiones de Aprendizaje Continuo

**Proposito:** Registrar cada sesion de desarrollo con agentes IA para construir una base de conocimiento acumulativa del proyecto.

---

## Como Registrar una Sesion

Cada sesion se documenta en un archivo individual en `sessions/` con el formato:
`YYYY-MM-DD_tema-breve.md`

### Plantilla de Sesion

```markdown
# Sesion: [Titulo descriptivo]

**Fecha:** YYYY-MM-DD
**Agente:** [Claude/otro]
**Area:** [backend|frontend|docker|n8n|db|general]
**Sprint:** [numero de sprint]
**Duracion aprox:** [tiempo]

## Objetivo
Que se buscaba lograr en esta sesion.

## Contexto Previo
Que se sabia/existia antes de empezar.

## Trabajo Realizado
- Cambio 1: descripcion
- Cambio 2: descripcion

## Decisiones Tomadas
- Decision 1: por que se eligio X sobre Y
- Decision 2: ...

## Errores Encontrados
- Error 1: descripcion → solucion (referencia a ERR-XXXX si aplica)

## Lecciones Aprendidas
- Leccion 1: que se aprendio que aplica a futuro
- Leccion 2: ...

## Archivos Modificados
- `ruta/archivo1.py` — que cambio
- `ruta/archivo2.tsx` — que cambio

## Siguiente Paso
Que queda pendiente para la proxima sesion.
```

---

## Indice de Sesiones

| Fecha | Tema | Area | Sprint | Archivo |
|-------|------|------|--------|---------|
| 2026-04-18 | Configuracion inicial del proyecto | general | 0 | [2026-04-18_configuracion-inicial.md](sessions/2026-04-18_configuracion-inicial.md) |
| 2026-04-18 | Sprint 1 backend: Alembic + auth JWT + refresh opaco | backend | 1 | [2026-04-18_sprint-1-backend-auth.md](sessions/2026-04-18_sprint-1-backend-auth.md) |
| 2026-04-18 | Sprint 1 frontend: cimientos UI + routing + auth | frontend | 1 | [2026-04-18_sprint-1-frontend-cimientos.md](sessions/2026-04-18_sprint-1-frontend-cimientos.md) |
| 2026-04-18 | Troubleshooting auth + PostgreSQL (Docker, pgAdmin, env) | backend | 1 | [2026-04-18_troubleshooting-auth-postgres.md](sessions/2026-04-18_troubleshooting-auth-postgres.md) |
| 2026-04-19 | Sprint 2 backend: Ventas (endpoints + service + tests) | backend | 2 | [2026-04-19_sprint-2-backend-ventas.md](sessions/2026-04-19_sprint-2-backend-ventas.md) |
| 2026-04-19 | Sprint 2 frontend: Dashboard General + Ventas | frontend | 2 | [2026-04-19_sprint-2-frontend-dashboard-ventas.md](sessions/2026-04-19_sprint-2-frontend-dashboard-ventas.md) |
| 2026-04-20 | Clientes en riesgo de abandono | backend + frontend | 2 | [2026-04-20_clientes-riesgo-abandono.md](sessions/2026-04-20_clientes-riesgo-abandono.md) |
| 2026-04-21 | Ventas: crecimiento mensual YoY por tipo de cliente | backend + frontend | 2 | [2026-04-21_ventas-crecimiento-mensual-yoy.md](sessions/2026-04-21_ventas-crecimiento-mensual-yoy.md) |
| 2026-04-21 | Sync n8n → webhook → PostgreSQL y validación de gráficas | backend + n8n + frontend | 2 | [2026-04-21_sync-n8n-y-validacion-graficas-ventas.md](sessions/2026-04-21_sync-n8n-y-validacion-graficas-ventas.md) |
| 2026-04-22 | Crecimiento trimestral: línea de porcentaje de crecimiento | frontend | 2 | [2026-04-22_crecimiento-trimestral-linea-porcentaje.md](sessions/2026-04-22_crecimiento-trimestral-linea-porcentaje.md) |

---

## Metricas Acumuladas

| Metrica | Valor |
|---------|-------|
| Total sesiones | 10 |
| Errores registrados | 11 |
| Lecciones documentadas | 11 |

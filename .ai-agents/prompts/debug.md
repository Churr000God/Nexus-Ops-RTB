# Prompt: Debug para Nexus Ops RTB

## Instrucciones
Hay un error en el proyecto Nexus Ops RTB. Sigue este flujo de diagnostico:

## Flujo de Debug
1. **Reproducir:** Identificar los pasos exactos para reproducir el error
2. **Aislar:** Determinar si es backend, frontend, docker, o BD
3. **Logs:** Revisar los logs relevantes:
   - Backend: `docker compose logs backend`
   - Frontend: Consola del navegador
   - PostgreSQL: `docker compose logs postgres`
   - n8n: `docker compose logs n8n`
   - Proxy: `docker compose logs proxy`
4. **Diagnosticar:** Identificar causa raiz
5. **Solucionar:** Implementar fix siguiendo convenciones de AGENTS.md
6. **Verificar:** Confirmar que el fix funciona y no rompe otra cosa
7. **Documentar:** Registrar en `.ai-agents/errors/ERROR_LOG.md`

## Comandos utiles
```bash
# Ver estado de servicios
docker compose ps
./scripts/health-check.sh

# Logs en tiempo real
docker compose logs -f backend
docker compose logs -f --tail=50 postgres

# Entrar al contenedor
docker compose exec backend bash
docker compose exec postgres psql -U nexus nexus_ops

# Reiniciar un servicio
docker compose restart backend
```

## Checklist post-fix
- [ ] El error esta resuelto
- [ ] No se rompieron otros tests/funcionalidades
- [ ] Se registro en ERROR_LOG.md
- [ ] Se actualizo la sesion de aprendizaje si aplica

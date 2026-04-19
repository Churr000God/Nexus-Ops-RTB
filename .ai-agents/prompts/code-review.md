# Prompt: Code Review para Nexus Ops RTB

## Instrucciones
Revisa el siguiente codigo del proyecto Nexus Ops RTB. El proyecto usa:
- Backend: Python 3.12 + FastAPI + SQLAlchemy 2 + PostgreSQL 16
- Frontend: React 18 + TypeScript + Vite + TailwindCSS + Recharts
- Infra: Docker Compose + Nginx + Cloudflare Tunnel

## Checklist de Revision
1. **Seguridad:** No hay secretos hardcodeados, SQL injection, XSS
2. **Tipado:** Type hints en Python, TypeScript strict en frontend
3. **Separacion:** Logica de negocio en services/, no en routers/
4. **Error handling:** Try/except con logging, no excepciones silenciadas
5. **Performance:** No queries N+1, uso de paginacion en listas
6. **Docker:** Cambios compatibles con docker-compose
7. **Tests:** Logica nueva tiene test correspondiente
8. **Convenciones:** Sigue AGENTS.md (naming, imports, estructura)

## Contexto adicional
- Leer `.ai-agents/AGENTS.md` para convenciones completas
- Revisar `.ai-agents/errors/ERROR_LOG.md` para errores conocidos

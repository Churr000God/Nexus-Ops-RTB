# Nexus Ops RTB — Índice de Estructura del Proyecto

**Fecha de creación:** 2026-04-17
**Propósito:** Documentos técnicos que definen la arquitectura, estructura de carpetas, estrategia de despliegue, seguridad, automatización y plan de implementación del proyecto Nexus Ops RTB.

---

## Archivos

| # | Archivo | Contenido |
|---|---------|-----------|
| 00 | [00_INDICE.md](00_INDICE.md) | Este archivo |
| 01 | [01_arquitectura_general.md](01_arquitectura_general.md) | Arquitectura expandida — diagrama completo y árbol de carpetas |
| 02 | [02_backend.md](02_backend.md) | Estructura del Backend (FastAPI, rutas, modelos, utils) |
| 03 | [03_frontend.md](03_frontend.md) | Estructura del Frontend (React + Vite, componentes, páginas) |
| 04 | [04_base_datos.md](04_base_datos.md) | Base de datos, ORM, migraciones y tablas |
| 05 | [05_automatizacion_n8n.md](05_automatizacion_n8n.md) | Flujos n8n, triggers, webhooks y actualización de CSV |
| 06 | [06_docker_despliegue.md](06_docker_despliegue.md) | Dockerfiles, docker-compose, imágenes y despliegue |
| 07 | [07_seguridad_autenticacion.md](07_seguridad_autenticacion.md) | JWT, Cloudflare Tunnel, red WiFi local, ACL |
| 08 | [08_scripts_git.md](08_scripts_git.md) | Scripts de sincronización local ↔ remoto del repositorio |

---

## Stack Tecnológico Propuesto

| Capa | Tecnología | Razón |
|------|-----------|-------|
| **Backend API** | Python 3.12 + FastAPI + Uvicorn | Rendimiento asíncrono, tipado y docs automáticas (OpenAPI/Swagger) |
| **Validación** | Pydantic v2 | Integrado nativamente con FastAPI |
| **ORM** | SQLAlchemy 2.x + Alembic | Migraciones versionadas |
| **Base de datos** | PostgreSQL 16 | Robustez, JSON nativo, ventanas analíticas |
| **Caché** | Redis 7 | Cache de consultas y colas ligeras |
| **Automatización** | n8n (self-hosted) | Flujos de actualización de CSV e integraciones |
| **Frontend** | React 18 + Vite + TypeScript | Velocidad de build y tipado |
| **Gráficas** | Recharts + Chart.js (complementario) | Recharts para barras/líneas/circular, Chart.js para casos avanzados |
| **Estilos** | TailwindCSS + shadcn/ui | Diseño coherente y componentes accesibles |
| **Auth** | JWT + refresh tokens | Stateless y simple |
| **Reverse proxy** | Nginx / Traefik | TLS local, rate limiting |
| **Túnel** | cloudflared (Cloudflare Tunnel) | Acceso remoto seguro |
| **Contenedores** | Docker + Docker Compose v2 | Despliegue repetible |
| **CI/CD** | GitHub Actions | Lint, tests y build automáticos |
| **Generación de reportes** | python-docx + WeasyPrint (o ReportLab) | DOCX nativo y PDF con estilos |
| **Envío de correo** | SMTP (aiosmtplib) | Sin dependencia externa |
| **Logs** | Loguru + archivos rotatorios | Simple y potente |
| **Observabilidad** | Healthchecks + `/metrics` Prometheus (opcional) | Para vigilar n8n y API |

> El stack es una propuesta — está sujeto a confirmación. Si prefieres otro lenguaje (Node/Express, Django), ajustamos los archivos.

---

## Árbol General del Proyecto (vista rápida)

```
nexus-ops-rtb/
├── backend/
├── frontend/
├── database/
├── automations/
├── docker/
├── scripts/
├── data/                 # CSV refrescados por n8n (montado en contenedores)
├── docs/
├── .github/
│   └── workflows/
├── cloudflare_tunnel.yml
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── .gitignore
├── Makefile
└── README.md
```

El desglose completo está en [01_arquitectura_general.md](01_arquitectura_general.md).

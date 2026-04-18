# Estructura Revisada del Proyecto Nexus Ops RTB

**Fecha:** 2026-04-18
**Propósito:** Auditoría de la estructura actual, gaps identificados y estructura definitiva mejorada.

---

## 1. Auditoría: Estado Actual vs. Diseño Propuesto

### Lo que YA existe y está bien:
| Componente | Estado | Notas |
|---|---|---|
| `docker-compose.yml` (dev) | Completo | Postgres, Redis, backend, frontend, n8n, proxy |
| `docker-compose.prod.yml` | Completo | Override prod + cloudflared |
| `backend/Dockerfile` | Funcional | Falta stage `prod` multi-stage |
| `frontend/Dockerfile` | Completo | Build + serve con nginx |
| Scripts git (pull/push) | Funcionales | Versión bash + powershell |
| `.env.example` | Completo | Todas las variables necesarias |
| `Makefile` | Básico | Faltan targets de deploy, test, lint |
| Documentación `estructura_proyecto/` | Muy completa | 8 docs de arquitectura |

### Gaps identificados:
| Gap | Severidad | Solución |
|---|---|---|
| No hay carpeta `.ai-agents/` | Alta | Crear con AGENTS.md, learning sessions, error log |
| Backend Dockerfile sin stage `prod` | Media | Agregar multi-stage con target prod |
| No hay `scripts/deploy.sh` completo | Alta | Crear script de deploy automático |
| No hay `scripts/health-check.sh` | Media | Crear script de verificación de salud |
| No hay `scripts/backup-db.sh` | Media | Crear script de backup PostgreSQL |
| No hay `.github/workflows/` | Media | Crear CI/CD básico |
| No hay `data/` en el repo (gitignored) | OK | Es correcto, se crea con init-project.sh |
| No hay `docs/` | Baja | La doc está en estructura_proyecto/, suficiente por ahora |
| No hay `database/` separado | Baja | Los modelos viven en backend/app/models/, está bien |
| Falta `.dockerignore` | Media | Crear para optimizar builds |
| No hay plan de sprints | Alta | Crear documento de sprints |

---

## 2. Estructura Definitiva Mejorada

```
nexus-ops-rtb/
│
├── .ai-agents/                              # [NUEVO] Configuración de agentes IA
│   ├── AGENTS.md                            # Guía maestra de agentes
│   ├── learning/                            # Sesiones de aprendizaje continuo
│   │   ├── SESSION_LOG.md                   # Registro de sesiones
│   │   └── sessions/                        # Sesiones individuales
│   │       └── YYYY-MM-DD_tema.md
│   ├── errors/                              # Registro de errores y soluciones
│   │   ├── ERROR_LOG.md                     # Índice de errores
│   │   └── resolutions/                     # Soluciones detalladas
│   │       └── ERR-XXXX_descripcion.md
│   └── prompts/                             # Prompts reutilizables
│       ├── code-review.md
│       ├── debug.md
│       └── feature-development.md
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── dependencies.py                  # [PENDIENTE] Auth, DB session
│   │   ├── routers/                         # (ya existe como routes/)
│   │   │   ├── __init__.py
│   │   │   ├── health.py                    # [EXISTE]
│   │   │   ├── auth.py                      # [PENDIENTE Sprint 2]
│   │   │   ├── dashboard.py                 # [PENDIENTE Sprint 3]
│   │   │   ├── ventas.py                    # [PENDIENTE Sprint 3]
│   │   │   ├── inventarios.py               # [PENDIENTE Sprint 4]
│   │   │   ├── proveedores.py               # [PENDIENTE Sprint 4]
│   │   │   ├── gastos.py                    # [PENDIENTE Sprint 5]
│   │   │   ├── administracion.py            # [PENDIENTE Sprint 5]
│   │   │   └── reportes.py                  # [PENDIENTE Sprint 6]
│   │   ├── models/                          # [PENDIENTE Sprint 2]
│   │   ├── schemas/                         # [PENDIENTE Sprint 2]
│   │   ├── services/                        # [PENDIENTE Sprint 3]
│   │   ├── utils/                           # [PENDIENTE Sprint 3]
│   │   └── middleware/                      # [PENDIENTE Sprint 2]
│   ├── tests/                               # [PENDIENTE Sprint 3+]
│   ├── alembic/                             # [PENDIENTE Sprint 2]
│   ├── alembic.ini                          # [PENDIENTE Sprint 2]
│   ├── requirements.txt                     # [EXISTE]
│   └── Dockerfile                           # [EXISTE - mejorar]
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── main.tsx                         # [EXISTE]
│   │   ├── App.tsx                          # [EXISTE]
│   │   ├── routes.tsx                       # [PENDIENTE Sprint 2]
│   │   ├── pages/                           # [PENDIENTE Sprint 3+]
│   │   ├── components/                      # [PENDIENTE Sprint 3+]
│   │   ├── hooks/                           # [PENDIENTE Sprint 3]
│   │   ├── services/                        # [PENDIENTE Sprint 3]
│   │   ├── store/                           # [PENDIENTE Sprint 3]
│   │   ├── types/                           # [PENDIENTE Sprint 2]
│   │   ├── utils/                           # [PENDIENTE Sprint 3]
│   │   └── styles/                          # [PENDIENTE Sprint 2]
│   ├── package.json                         # [EXISTE]
│   ├── tsconfig.json                        # [EXISTE]
│   ├── vite.config.ts                       # [EXISTE]
│   ├── tailwind.config.js                   # [PENDIENTE Sprint 2]
│   ├── postcss.config.js                    # [PENDIENTE Sprint 2]
│   └── Dockerfile                           # [EXISTE]
│
├── automations/
│   ├── n8n_flows/                           # [EXISTE - vacío]
│   └── README.md                            # [PENDIENTE Sprint 5]
│
├── docker/
│   ├── cloudflared/
│   │   └── config.yml                       # [EXISTE]
│   ├── nginx/
│   │   ├── default.conf                     # [EXISTE]
│   │   └── default.prod.conf                # [EXISTE]
│   └── postgres/
│       └── init.sql                         # [EXISTE]
│
├── scripts/
│   ├── lib/
│   │   └── common.sh                        # [EXISTE]
│   ├── init-project.sh                      # [EXISTE]
│   ├── start-dev.sh                         # [EXISTE]
│   ├── stop.sh                              # [EXISTE]
│   ├── pull-auto.sh                         # [EXISTE]
│   ├── pull-auto.ps1                        # [EXISTE]
│   ├── push-auto-branch.sh                  # [EXISTE]
│   ├── push-auto-branch.ps1                 # [EXISTE]
│   ├── deploy.sh                            # [NUEVO] Deploy automático
│   ├── update-and-deploy.sh                 # [NUEVO] Pull + rebuild + deploy
│   ├── health-check.sh                      # [NUEVO] Verificación de salud
│   ├── backup-db.sh                         # [NUEVO] Backup PostgreSQL
│   └── restore-db.sh                        # [NUEVO] Restaurar backup
│
├── .github/
│   └── workflows/
│       └── ci.yml                           # [NUEVO] Lint + tests
│
├── data/                                    # (gitignored, se crea con init)
│   ├── csv/
│   ├── reports/
│   ├── logs/
│   └── backups/
│
├── docker-compose.yml                       # [EXISTE]
├── docker-compose.prod.yml                  # [EXISTE]
├── .env.example                             # [EXISTE]
├── .gitignore                               # [EXISTE - mejorar]
├── .dockerignore                            # [NUEVO]
├── Makefile                                 # [EXISTE - mejorar]
└── README.md                                # [EXISTE]
```

---

## 3. Decisiones Arquitectónicas Clave

### 3.1 Por qué NO separar `database/` como carpeta raíz
La estructura original del usuario proponía una carpeta `database/` separada. Esto se descarta porque:
- Los modelos SQLAlchemy viven naturalmente en `backend/app/models/`
- Las migraciones viven en `backend/alembic/`
- El esquema inicial SQL vive en `docker/postgres/init.sql`
- Separar crearía imports cruzados innecesarios

### 3.2 `routers/` vs `routes/`
FastAPI usa la convención `routers/` (con APIRouter). El proyecto ya tiene `routers/` creado. Se mantiene.

### 3.3 Carpeta `.ai-agents/` en raíz
Se coloca en raíz (no dentro de docs/) porque:
- Es un recurso operativo, no documentación pasiva
- Los agentes IA la necesitan accesible desde cualquier contexto
- El error log se actualiza durante desarrollo activo

### 3.4 Docker multi-stage para backend
El Dockerfile actual solo tiene un stage. Se debe agregar `prod` target para el docker-compose.prod.yml que ya lo referencia.

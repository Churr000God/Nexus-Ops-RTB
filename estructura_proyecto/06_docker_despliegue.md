# Docker y Despliegue

**Propósito:** Describir los contenedores, `docker-compose`, estrategias de entornos (dev/prod), volúmenes, redes y el pipeline CI/CD en AWS para un despliegue automatizado y repetible.

> **Nota importante:** La base de datos de la aplicación vive en **Supabase** (PostgreSQL externo). No hay contenedor `postgres` local para la app. El único contenedor de postgres en Docker es `postgres-n8n`, dedicado exclusivamente a n8n.

---

## 1. Servicios en el Compose

| Servicio | Imagen / Build | Puertos expuestos | Depende de |
|----------|---------------|-------------------|------------|
| `redis` | `redis:7-alpine` | 6379 (interno) | — |
| `backend` | build `./backend` | 8000 (interno) | redis |
| `frontend` | build `./frontend` | 80 (interno) | backend |
| `proxy` | `nginx:1.27-alpine` | 80 / 443 (externo) | backend, frontend |
| `postgres-n8n` | `postgres:16-alpine` | 5432 (interno) | — |
| `n8n` | `n8nio/n8n:latest` | 5678 (interno) | postgres-n8n |
| `cloudflared` | `cloudflare/cloudflared:latest` | — | proxy |

---

## 2. Estructura de Directorios Docker

```
docker/
├── nginx/
│   ├── default.conf            # Vhost dev (HTTP)
│   └── default.prod.conf       # Vhost prod (HTTP→backend, proxy_pass)
├── cloudflared/
│   ├── config.yml              # Config del túnel (en .gitignore)
│   └── credentials.json        # Credenciales del túnel (en .gitignore)
scripts/
├── init-project.sh             # Arranque completo del stack (dev)
├── init-dev.ps1                # Implementación PowerShell del arranque
├── stop.sh                     # Detener stack preservando volúmenes
├── setup-db.sh                 # Setup completo de BD (migraciones + seed)
├── backup-db.sh                # Backup comprimido en data/backups/
├── restore-db.sh               # Restaurar backup
├── update-safe.sh              # Actualización segura (pull+backup+build+migrate)
├── health-check.sh             # Verificar estado de todos los servicios
└── codedeploy/                 # Hooks del pipeline AWS CodeDeploy
    ├── before_install.sh
    ├── after_install.sh
    ├── application_start.sh
    └── validate_service.sh
```

---

## 3. `docker-compose.yml` (desarrollo)

El stack de desarrollo usa bind-mounts para hot-reload. La BD apunta a Supabase vía `DATABASE_URL_DOCKER` (relay para Docker/WSL2).

```yaml
name: nexus-ops-rtb

services:
  postgres-n8n:           # Solo para n8n — no es la BD de la app
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${N8N_DB_NAME}
      POSTGRES_USER: ${N8N_POSTGRES_USER}
      POSTGRES_PASSWORD: ${N8N_POSTGRES_PASSWORD}
    volumes:
      - n8n_postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  backend:
    build: { context: ./backend }
    env_file: .env
    environment:
      ENV: development
      DATABASE_URL: ${DATABASE_URL_DOCKER}   # relay WSL2/Docker
    volumes:
      - ./backend:/app
      - ./data/csv:/data/csv
      - ./data/reports:/data/reports
    depends_on:
      redis: { condition: service_healthy }
    ports: ["8000:8000"]
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build:
      context: ./frontend
      args:
        VITE_API_URL: ${VITE_API_URL}
    env_file: .env
    ports: ["5173:80"]

  n8n:
    image: n8nio/n8n:latest
    env_file: .env
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres-n8n
      - DB_POSTGRESDB_DATABASE=${N8N_DB_NAME}
    volumes:
      - ./automations/n8n_data:/home/node/.n8n
      - ./data/csv:/data/csv
    depends_on:
      postgres-n8n: { condition: service_healthy }
    ports: ["5678:5678"]

  proxy:
    image: nginx:1.27-alpine
    volumes:
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    ports: ["80:80"]
    depends_on: [backend, frontend, n8n]

volumes:
  n8n_postgres_data:
  redis_data:
```

---

## 4. `docker-compose.prod.yml` (overrides de producción)

Activa el target `prod` de los Dockerfiles, elimina bind-mounts, fuerza `DATABASE_URL` directa a Supabase y añade `cloudflared`.

```yaml
services:
  backend:
    build:
      context: ./backend
      target: prod
    environment:
      ENV: production
      DATABASE_URL: ${DATABASE_URL}    # URL directa a Supabase (sin relay)
    volumes: []
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      target: serve
    restart: unless-stopped

  proxy:
    volumes:
      - ./docker/nginx/default.prod.conf:/etc/nginx/conf.d/default.conf:ro
      - ./docker/nginx/certs:/etc/nginx/certs:ro
    ports: ["80:80", "443:443"]
    restart: unless-stopped

  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate run --config /etc/cloudflared/config.yml
    volumes:
      - ./docker/cloudflared/config.yml:/etc/cloudflared/config.yml:ro
      - ./docker/cloudflared/credentials.json:/etc/cloudflared/credentials.json:ro
    depends_on: [proxy]
    restart: unless-stopped
```

Comando para producción:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 5. Reverse Proxy — Nginx (producción)

```nginx
# docker/nginx/default.prod.conf
upstream backend  { server backend:8000; }
upstream frontend { server frontend:80; }

server {
    listen 80;
    server_name _;
    client_max_body_size 50M;

    location /api/ {
        proxy_pass http://backend/api/;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location / {
        proxy_pass http://frontend/;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> `VITE_API_URL` debe estar **vacío** en producción (`VITE_API_URL=`) para que las llamadas del frontend sean paths relativos (`/api/...`) que nginx proxea al backend. Si se pone `http://localhost:8000`, el browser bloquea las peticiones por política de "loopback privado".

---

## 6. Variables de Entorno Clave

| Variable | Dev | Prod | Descripción |
|----------|-----|------|-------------|
| `DATABASE_URL` | URL directa Supabase | URL directa Supabase | Usada en prod por `docker-compose.prod.yml` |
| `DATABASE_URL_DOCKER` | URL relay WSL2 | No se usa | Workaround Docker/WSL2 para dev |
| `VITE_API_URL` | `http://localhost:8000` | `` (vacío) | Se hornea en el bundle de React en build time |
| `JWT_SECRET` | cualquier string | string largo aleatorio | Secreto para tokens JWT |
| `REDIS_URL` | `redis://redis:6379` | `redis://redis:6379` | Mismo nombre de servicio en ambos entornos |

---

## 7. Volúmenes y Datos Persistentes

| Volumen / Mount | Contenido | Persistencia |
|-----------------|-----------|-------------|
| `n8n_postgres_data` (named) | BD de n8n | Persiste entre reinicios |
| `redis_data` (named) | Caché y colas | Persiste entre reinicios |
| `./data/csv` | CSVs generados por n8n | Repositorio / EC2 |
| `./data/reports` | DOCX/PDF generados | EC2 |
| `./data/backups` | Backups de Supabase | EC2 (gitignored) |
| `./automations/n8n_data` | Config y credenciales n8n | EC2 (gitignored) |
| `./docker/cloudflared/` | Credenciales del túnel | EC2 (gitignored) |

---

## 8. Healthchecks y Políticas de Restart

- `backend`: expone `GET /health` → 200 (liveness + DB + Redis).
- `redis` y `postgres-n8n`: healthchecks nativos de Docker.
- Todos los servicios de producción: `restart: unless-stopped`.

---

## 9. Scripts de Operación

| Script | Cuándo usarlo |
|--------|--------------|
| `./scripts/init-project.sh` | Primera vez o reinicio completo en dev |
| `.\scripts\init-dev.ps1` | Equivalente PowerShell |
| `./scripts/stop.sh` | Detener sin destruir volúmenes |
| `./scripts/setup-db.sh` | Aplicar migraciones + seed en BD limpia |
| `./scripts/backup-db.sh` | Backup manual de Supabase |
| `./scripts/restore-db.sh` | Restaurar backup |
| `./scripts/update-safe.sh` | **Actualización de producción** (pull + backup + build + migrate) |
| `./scripts/health-check.sh` | Verificar estado del stack |

---

## 10. CI/CD — AWS CodePipeline

El despliegue automatizado usa **AWS CodePipeline** con tres etapas: Source (GitHub), Build (CodeBuild) y Deploy (CodeDeploy → EC2).

Para la documentación completa del pipeline ver: [`docs/despliegue_aws_codepipeline.md`](../docs/despliegue_aws_codepipeline.md)

### Flujo resumido

```
Push a main
    ↓
CodePipeline detecta cambio (GitHub webhook)
    ↓
CodeBuild (buildspec.yml)
  • npm --prefix frontend ci
  • npm --prefix frontend run lint       ← falla el pipeline si hay errores
  • npm --prefix frontend run typecheck  ← falla el pipeline si hay errores TS
  • tar -czf /tmp/deploy.tgz ...         ← empaqueta artefacto sin .env/.git/node_modules
    ↓
CodeDeploy → EC2 (appspec.yml)
  • BEFORE_DEPLOY  → before_install.sh  (detiene backend/frontend/proxy)
  • DEPLOY         → copia archivos a /home/ec2-user/nexus-ops-rtb
  • AFTER_DEPLOY   → after_install.sh   (linkea .env, permisos)
                   → application_start.sh (docker build + alembic + up)
                   → validate_service.sh  (healthchecks HTTP)
```

### Archivos del pipeline

| Archivo | Propósito |
|---------|-----------|
| `buildspec.yml` | Instrucciones para CodeBuild |
| `appspec.yml` | Instrucciones para CodeDeploy (hooks + destino) |
| `scripts/codedeploy/before_install.sh` | Para servicios antes de sobreescribir archivos |
| `scripts/codedeploy/after_install.sh` | Permisos, .env, directorios de datos |
| `scripts/codedeploy/application_start.sh` | Build Docker + migraciones + stack up |
| `scripts/codedeploy/validate_service.sh` | Verifica que la app responde correctamente |

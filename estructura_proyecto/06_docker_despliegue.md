# Docker y Despliegue

**Propósito:** Describir los contenedores, `docker-compose`, estrategias de entornos (dev/prod), volúmenes, redes y reverse proxy para un despliegue repetible y automatizado.

---

## 1. Servicios en el Compose

| Servicio | Imagen / Build | Puertos | Depende de |
|----------|---------------|---------|------------|
| `postgres` | `postgres:16-alpine` | 5432 (interno) | — |
| `redis` | `redis:7-alpine` | 6379 (interno) | — |
| `backend` | build `./backend` | 8000 (interno) | postgres, redis |
| `frontend` | build `./frontend` | 80 (interno) | backend |
| `n8n` | `n8nio/n8n:latest` | 5678 (interno) | postgres |
| `proxy` | `nginx:1.27-alpine` o `traefik:v3` | 80/443 (externo) | backend, frontend, n8n |
| `cloudflared` | `cloudflare/cloudflared:latest` | — | proxy |

---

## 2. Estructura de Directorios Docker

```
docker/
├── nginx/
│   ├── default.conf                 # Vhost interno (dev)
│   ├── default.prod.conf            # Vhost de producción con TLS local
│   └── nginx.conf                   # Base
├── traefik/                         # Alternativa a Nginx
│   ├── traefik.yml
│   └── dynamic.yml
├── postgres/
│   └── init.sql                     # Crea DB si no existe
├── cloudflared/
│   ├── config.yml                   # (copia del cloudflare_tunnel.yml raíz)
│   └── credentials.json             # (en .gitignore)
└── scripts/
    ├── wait-for-postgres.sh
    └── entrypoint-backend.sh
```

---

## 3. `docker-compose.yml` (desarrollo)

```yaml
name: nexus-ops-rtb

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      retries: 5

  backend:
    build:
      context: ./backend
    env_file: .env
    volumes:
      - ./backend:/app
      - ./data/csv:/data/csv
      - ./data/reports:/data/reports
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    ports:
      - "8000:8000"
    command: >
      bash -c "alembic upgrade head &&
               uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

  frontend:
    build:
      context: ./frontend
    env_file: .env
    depends_on: [backend]
    ports:
      - "5173:80"

  n8n:
    image: n8nio/n8n:latest
    env_file: .env
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_DATABASE=${N8N_DB_NAME}
      - DB_POSTGRESDB_USER=${POSTGRES_USER}
      - DB_POSTGRESDB_PASSWORD=${POSTGRES_PASSWORD}
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
    volumes:
      - ./automations/n8n_data:/home/node/.n8n
      - ./automations/n8n_flows:/flows
      - ./data/csv:/data/csv
    depends_on: [postgres]
    ports:
      - "5678:5678"

  proxy:
    image: nginx:1.27-alpine
    volumes:
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "80:80"
    depends_on: [backend, frontend, n8n]

volumes:
  postgres_data:
  redis_data:
```

---

## 4. `docker-compose.prod.yml` (overrides)

```yaml
services:
  backend:
    build:
      context: ./backend
      target: prod
    volumes: []          # sin bind-mount del código
    command: >
      bash -c "alembic upgrade head &&
               uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4"
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
    ports:
      - "80:80"
      - "443:443"
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

Uso:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 5. Reverse Proxy — Nginx (producción)

```nginx
# docker/nginx/default.prod.conf
upstream backend { server backend:8000; }
upstream frontend { server frontend:80; }
upstream n8n { server n8n:5678; }

server {
    listen 443 ssl http2;
    server_name nexus-ops.local;

    ssl_certificate     /etc/nginx/certs/nexus-ops.crt;
    ssl_certificate_key /etc/nginx/certs/nexus-ops.key;

    # Restricción a red local + túnel Cloudflare (se confía en x-forwarded-for del túnel)
    allow 192.168.0.0/16;
    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    deny  all;

    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /n8n/ {
        auth_basic "n8n";
        auth_basic_user_file /etc/nginx/.htpasswd_n8n;
        proxy_pass http://n8n/;
    }

    location / {
        proxy_pass http://frontend;
    }
}
```

---

## 6. Healthchecks y Restart Policies

- Todos los servicios productivos: `restart: unless-stopped`.
- Healthchecks:
  - `backend` expone `/health` (liveness) y `/ready` (incluye DB + Redis).
  - `postgres` y `redis` tienen checks nativos.
  - `n8n` no expone health oficial — se usa `curl -f http://localhost:5678/` como proxy.

---

## 7. Volúmenes y Datos Persistentes

| Volumen | Ruta host (dev) | Contenido |
|---------|-----------------|-----------|
| `postgres_data` | named volume | DB binaria |
| `redis_data` | named volume | Cache / colas |
| `./data/csv` | bind mount | CSV refrescados por n8n |
| `./data/reports` | bind mount | DOCX/PDF generados |
| `./automations/n8n_data` | bind mount | Credenciales y config de n8n |
| `./docker/cloudflared/*` | bind mount | Credenciales del túnel |

---

## 8. Redes

- Red interna `nexus_net` (bridge) para que los servicios se resuelvan por nombre.
- `proxy` y `cloudflared` son los únicos que exponen puertos al host.

---

## 9. Variables de Entorno

Referencia completa en `09_variables_entorno.md`. En resumen, se cargan desde `.env` del root con `env_file:` en cada servicio.

---

## 10. CI/CD — GitHub Actions

```
.github/workflows/
├── ci.yml                 # Lint + tests en cada PR
├── build.yml              # Build de imágenes al taggear release
└── deploy.yml             # SSH → pull → compose up en servidor
```

Ejemplo `ci.yml`:
```yaml
name: CI
on: [pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r backend/requirements.txt
      - run: ruff check backend
      - run: pytest backend/tests
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - working-directory: frontend
        run: |
          npm ci
          npm run lint
          npm run test -- --run
          npm run build
```

---

## 11. Despliegue en el Servidor (flujo)

1. SSH al servidor.
2. `git pull origin main` (o `scripts/update-repo.sh`).
3. `docker compose -f docker-compose.yml -f docker-compose.prod.yml pull`.
4. `docker compose ... up -d --build`.
5. Verificar `docker compose ps` y `/health`.
6. Logs: `docker compose logs -f backend`.

Todo encapsulado en `scripts/deploy.sh` (ver `08_scripts_git.md`).

---

## 12. Makefile

```makefile
.PHONY: up down logs ps rebuild migrate seed backup prod-up prod-down

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

ps:
	docker compose ps

rebuild:
	docker compose build --no-cache

migrate:
	docker compose exec backend alembic upgrade head

seed:
	docker compose exec backend python -m app.scripts.seed

backup:
	./scripts/backup-db.sh

prod-up:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down
```

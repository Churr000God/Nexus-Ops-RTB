# Despliegue — AWS CodePipeline + CodeBuild + CodeDeploy + EC2

**Fecha de implementación:** 2026-05-06  
**Estado:** Activo en producción

---

## Visión General

Nexus Ops RTB utiliza un pipeline de CI/CD completamente automatizado en AWS. Cada push a la rama `main` desencadena una cadena de tres etapas que valida el código, empaqueta el artefacto y lo despliega en el servidor EC2 de producción sin intervención manual.

```
┌─────────────────────────────────────────────────────────────────┐
│                      AWS CodePipeline                           │
│                                                                 │
│  ┌──────────┐    ┌───────────────┐    ┌─────────────────────┐  │
│  │  Source  │───▶│  Build        │───▶│  Deploy             │  │
│  │ (GitHub) │    │ (CodeBuild)   │    │ (CodeDeploy → EC2)  │  │
│  │          │    │               │    │                     │  │
│  │ main     │    │ lint          │    │ BeforeInstall       │  │
│  │          │    │ typecheck     │    │ Install (files)     │  │
│  │          │    │ package       │    │ AfterInstall        │  │
│  │          │    │               │    │ ApplicationStart    │  │
│  └──────────┘    └───────────────┘    │ ValidateService     │  │
│                                       └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Infraestructura Requerida

### Recursos AWS

| Recurso | Nombre / ID | Notas |
|---------|------------|-------|
| EC2 Instance | `i-0bcdfc7d3cdbcb8db` (Ops-Nexus-RTB) | Amazon Linux 2023 |
| IAM Role EC2 | `EC2Role-SSM-Nexus-RTB` | Necesita permisos S3 + SSM |
| IAM Role Pipeline | `AWSCodePipelineServiceRole-us-east-1-nexus-ops-rtb` | Necesita ec2:Describe + ssm:SendCommand |
| S3 Bucket artefactos | `codepipeline-us-east-1-4cdf5acc9f0c-4c57-8831-35008eb5f4ae` | Creado automáticamente por CodePipeline |

### Políticas IAM necesarias en `EC2Role-SSM-Nexus-RTB`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CodePipelineArtifactAccess",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:GetObjectVersion"],
      "Resource": "arn:aws:s3:::codepipeline-us-east-1-4cdf5acc9f0c-4c57-8831-35008eb5f4ae/*"
    },
    {
      "Sid": "CodePipelineBucketList",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::codepipeline-us-east-1-4cdf5acc9f0c-4c57-8831-35008eb5f4ae"
    }
  ]
}
```

### Políticas IAM necesarias en `AWSCodePipelineServiceRole-...`

Debe incluir: `ec2:DescribeInstances` y `ssm:SendCommand` sobre la instancia EC2.

---

## Prerrequisitos en el EC2 (setup único)

### 1. Instalar Docker y Docker Compose v2

```bash
# Amazon Linux 2023
sudo dnf update -y
sudo dnf install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Docker Buildx (requiere v0.17.0+)
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -L \
  https://github.com/docker/buildx/releases/download/v0.20.0/buildx-v0.20.0.linux-amd64 \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx

# Docker Compose v2
COMPOSE_V=$(curl -s https://api.github.com/repos/docker/compose/releases/latest \
  | grep '"tag_name"' | cut -d'"' -f4)
sudo curl -L \
  "https://github.com/docker/compose/releases/download/${COMPOSE_V}/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Verificar
docker --version && docker compose version && docker buildx version
```

### 2. Configurar el archivo `.env` de producción

El `.env` **no viaja en el artefacto** (excluido en `buildspec.yml`). Debe guardarse en el servidor antes del primer deploy:

```bash
sudo nano /home/ec2-user/.nexus-ops-rtb.env
# Pegar el contenido del .env de producción
sudo chmod 600 /home/ec2-user/.nexus-ops-rtb.env
```

Variables críticas en el `.env` de producción:

```bash
# Base de datos (Supabase — URL directa, sin relay)
DATABASE_URL=postgresql+psycopg://usuario:password@host.supabase.co:5432/postgres

# Frontend (vacío = paths relativos, nginx los proxea)
VITE_API_URL=

# JWT
JWT_SECRET=string-largo-y-aleatorio-de-produccion

# Redis (nombre del servicio Docker)
REDIS_URL=redis://redis:6379
```

### 3. Crear directorio de destino

```bash
mkdir -p /home/ec2-user/nexus-ops-rtb
```

### 4. Verificar SSM Agent

```bash
sudo systemctl status amazon-ssm-agent
# Si no está corriendo:
sudo systemctl start amazon-ssm-agent
sudo systemctl enable amazon-ssm-agent
```

---

## Archivos del Pipeline

### `buildspec.yml` (raíz del repositorio)

Ejecutado por **CodeBuild**. Valida el frontend y empaqueta el artefacto.

```yaml
version: 0.2

env:
  shell: bash

phases:
  install:
    runtime-versions:
      nodejs: 20
    commands:
      - npm --prefix frontend ci --no-audit --no-fund

  pre_build:
    commands:
      - npm --prefix frontend run lint       # Falla si hay errores ESLint
      - npm --prefix frontend run typecheck  # Falla si hay errores TypeScript

  build:
    commands:
      - find scripts -name "*.sh" -exec chmod 755 {} \; 2>/dev/null || true
      - rm -rf deploy && mkdir -p deploy
      # /tmp evita el error "file changed as we read it"
      - tar -czf /tmp/deploy.tgz --exclude='*/node_modules' --exclude='node_modules'
          --exclude='.git' --exclude='.env' --exclude='data/backups'
          --exclude='data/logs' --exclude='deploy' .
      - tar -xzf /tmp/deploy.tgz -C deploy
      - rm /tmp/deploy.tgz

artifacts:
  base-directory: deploy
  files:
    - '**/*'

cache:
  paths:
    - frontend/node_modules/**/*
    - /root/.npm/**/*
```

**Notas importantes:**
- `cd frontend &&` no funciona entre fases de CodeBuild (cada fase abre un shell nuevo). Se usa `npm --prefix frontend` en su lugar.
- El `.env` se excluye explícitamente — las credenciales nunca viajan en el artefacto.
- El tarball se crea en `/tmp` para evitar que `tar` se archive a sí mismo.

---

### `appspec.yml` (raíz del repositorio)

Ejecutado por **CodeDeploy**. Define destino y hooks del deploy.

```yaml
version: 0.0

files:
  - source: /
    destination: /home/ec2-user/nexus-ops-rtb

hooks:
  BeforeInstall:
    - location: scripts/codedeploy/before_install.sh
      timeout: 300
      runas: root

  AfterInstall:
    - location: scripts/codedeploy/after_install.sh
      timeout: 300
      runas: root

  ApplicationStart:
    - location: scripts/codedeploy/application_start.sh
      timeout: 600
      runas: root

  ValidateService:
    - location: scripts/codedeploy/validate_service.sh
      timeout: 120
      runas: root
```

**Notas:** Las claves `os` y `permissions` no son soportadas por el deploy action de CodePipeline EC2 y generan warnings — se omiten.

---

## Scripts de Hooks (`scripts/codedeploy/`)

Todos los scripts exportan `PATH` al inicio para garantizar que Docker sea encontrado cuando corren como `root` vía SSM:

```bash
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
```

### `before_install.sh`
Corre **antes** de copiar los archivos nuevos. Detiene los servicios en ejecución para evitar conflictos de escritura.

### `after_install.sh`
Corre **después** de copiar los archivos. Responsabilidades:
- Copia `/home/ec2-user/.nexus-ops-rtb.env` → `APP_DIR/.env`
- Crea directorios `data/backups`, `data/logs`, `data/csv`, `data/reports`
- Establece permisos correctos con `chown ec2-user:ec2-user`

### `application_start.sh`
Construye y levanta el stack. Flujo:
1. `docker compose build backend frontend`
2. `docker compose up -d redis`
3. `docker compose up -d backend` → espera hasta `healthy` (máx 90s)
4. `docker compose exec -T backend alembic upgrade head`
5. `docker compose up -d frontend proxy cloudflared`
6. `nginx -s reload` para refrescar upstreams

### `validate_service.sh`
Verifica que el deploy fue exitoso:
- Estado `running` de contenedores: `redis`, `backend`, `frontend`, `proxy`
- `GET http://localhost:8000/health` → 200
- `GET http://localhost/` → 200/301/302

Si algún check crítico falla, devuelve exit code 1 → CodeDeploy marca el deployment como fallido.

---

## Flujo de Despliegue Completo

```
1. Developer hace push a main en GitHub
        ↓
2. CodePipeline detecta el evento (webhook)
        ↓
3. [CodeBuild] INSTALL
   └─ npm --prefix frontend ci
        ↓
4. [CodeBuild] PRE_BUILD
   ├─ npm --prefix frontend run lint      → falla aquí si hay errores ESLint
   └─ npm --prefix frontend run typecheck → falla aquí si hay errores TypeScript
        ↓
5. [CodeBuild] BUILD
   └─ tar -czf /tmp/deploy.tgz (excluye .env, .git, node_modules)
   └─ extrae en deploy/ → sube a S3 como artefacto
        ↓
6. [CodeDeploy] BEFORE_DEPLOY (→ before_install.sh)
   └─ Detiene backend, frontend, proxy
        ↓
7. [CodeDeploy] DEPLOY
   └─ Copia todos los archivos a /home/ec2-user/nexus-ops-rtb
        ↓
8. [CodeDeploy] AFTER_DEPLOY
   ├─ after_install.sh    → .env, permisos, directorios
   ├─ application_start.sh → build + migrate + up
   └─ validate_service.sh → healthchecks
        ↓
9. CodePipeline marca el deployment como SUCCEEDED
```

---

## Variables de Entorno Críticas por Entorno

| Variable | Desarrollo | Producción (EC2) |
|----------|-----------|-----------------|
| `DATABASE_URL` | URL Supabase directa | URL Supabase directa |
| `DATABASE_URL_DOCKER` | URL relay WSL2/Docker | **No se usa** |
| `VITE_API_URL` | `http://localhost:8000` | `` (vacío) |
| `ENV` | `development` | `production` (set en compose.prod.yml) |

> **Por qué `VITE_API_URL` vacío en prod:** La variable se hornea en el bundle de React en `docker compose build`. En producción, nginx proxea `/api/*` al backend. Si se pone `http://localhost:8000`, el browser bloquea la petición porque `localhost` es un loopback y el origen es la IP pública.

---

## Troubleshooting

### Error: `cd frontend: No such file or directory` en CodeBuild
**Causa:** Cada fase de CodeBuild abre un shell nuevo — `cd` no persiste entre fases.  
**Fix:** Usar `npm --prefix frontend <comando>` en lugar de `cd frontend && npm`.

### Error: `tar: file changed as we read it`
**Causa:** `tar` archivaba el directorio actual (`.`) y encontraba el propio `deploy.tgz` mientras lo creaba.  
**Fix:** Crear el tarball en `/tmp` (`tar -czf /tmp/deploy.tgz`).

### Error: `docker: command not found` en hook scripts
**Causa:** Los scripts corren como `root` vía SSM con un PATH mínimo que no incluye Docker.  
**Fix:** Agregar `export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"` al inicio de cada script.

### Error: `compose build requires buildx 0.17.0 or later`
**Causa:** Versión de Docker Buildx desactualizada en el EC2.  
**Fix:** Instalar buildx ≥ v0.17.0:
```bash
sudo curl -L https://github.com/docker/buildx/releases/download/v0.20.0/buildx-v0.20.0.linux-amd64 \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
```

### Error: `Name or service not known` en alembic migrate
**Causa:** El backend usa `DATABASE_URL_DOCKER` (relay WSL2) que no existe en EC2.  
**Fix:** Agregar `DATABASE_URL: ${DATABASE_URL}` en el servicio `backend` de `docker-compose.prod.yml`.

### Error: `Access to fetch at 'http://localhost:8000'` bloqueado por CORS
**Causa:** `VITE_API_URL=http://localhost:8000` horneado en el bundle de frontend.  
**Fix:** Establecer `VITE_API_URL=` (vacío) en el `.env` del EC2 y reconstruir con `--no-cache`:
```bash
sed -i 's|^VITE_API_URL=.*|VITE_API_URL=|' /home/ec2-user/nexus-ops-rtb/.env
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d frontend
```

### Error: S3 AccessDenied al descargar artefacto en EC2
**Causa:** El IAM Role del EC2 no tiene `s3:GetObject` sobre el bucket de CodePipeline.  
**Fix:** Agregar política inline `CodePipelineArtifactRead` al role `EC2Role-SSM-Nexus-RTB` con el ARN completo del bucket.

---

## Operaciones Manuales en Producción

### Actualizar solo el frontend (sin pipeline)
```bash
cd /home/ec2-user/nexus-ops-rtb
# Editar .env si es necesario
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d frontend
```

### Aplicar migraciones manualmente
```bash
cd /home/ec2-user/nexus-ops-rtb
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend alembic upgrade head
```

### Ver logs en tiempo real
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f frontend
```

### Health check completo
```bash
cd /home/ec2-user/nexus-ops-rtb
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
curl -s http://localhost:8000/health
curl -s -o /dev/null -w "%{http_code}" http://localhost/
```

### Rollback al deploy anterior
Si el pipeline incluye rollback automático configurado en CodeDeploy, se activa solo al fallar `validate_service.sh`. Para rollback manual:
```bash
# En CodeDeploy Console: Deployments → seleccionar deployment anterior → Redeploy
# O vía CLI:
aws deploy create-deployment \
  --application-name nexus-ops-rtb \
  --deployment-group-name production \
  --deployment-config-name CodeDeployDefault.OneAtATime \
  --s3-location bucket=BUCKET,key=ARTIFACT_KEY,bundleType=zip
```

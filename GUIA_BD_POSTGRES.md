# Guia Basica de Base de Datos (PostgreSQL)

## Objetivo
Esta guia resume comandos utiles para trabajar con PostgreSQL en Nexus Ops RTB desde:
- pgAdmin (interfaz visual)
- Terminal (PowerShell + `docker` + `psql`)
- Troubleshooting real aplicado durante la configuracion de auth/login

---

## 1) Datos de conexion

### 1.1 Conexion desde cliente local (DBeaver/pgAdmin de escritorio)
- Host: `localhost` o `127.0.0.1`
- Puerto: `5432`
- Base de datos: `nexus_ops`
- Usuario: `nexus`
- Password: valor de `POSTGRES_PASSWORD` en `.env`

### 1.2 Conexion desde pgAdmin en contenedor Docker
Si pgAdmin corre como contenedor separado, `localhost` no apunta al host.
Usar:
- Host: `host.docker.internal`
- Puerto: `5432`
- Base de datos: `nexus_ops`
- Usuario: `nexus`
- Password: valor de `POSTGRES_PASSWORD` en `.env`

---

## 2) Comandos utiles (terminal)

### 2.1 Ver estado de contenedores y puertos
```powershell
docker compose ps
docker ps --format "{{.Names}}\t{{.Ports}}"
docker compose port postgres 5432
```

### 2.2 Probar puerto 5432 en Windows
```powershell
Test-NetConnection 127.0.0.1 -Port 5432
```

### 2.3 Entrar a PostgreSQL dentro del contenedor
```powershell
docker exec -it nexus-ops-rtb-postgres-1 psql -U nexus -d nexus_ops
```

### 2.4 Comandos `psql` de inspeccion
```sql
\l
\dt
\d users
SELECT id, email, role, is_active, created_at FROM users ORDER BY created_at DESC;
SELECT id, user_id, expires_at, created_at FROM refresh_tokens ORDER BY created_at DESC;
\q
```

### 2.5 Reset puntual de password del usuario de BD
```powershell
docker exec -it nexus-ops-rtb-postgres-1 psql -U nexus -d postgres -c "ALTER USER nexus WITH PASSWORD 'TU_PASSWORD_REAL';"
```

---

## 3) Comandos utiles (API auth)

### 3.1 Registrar usuario
```powershell
$body = @{ email="usuario@empresa.com"; password="ClaveSegura1!!" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/auth/register" -ContentType "application/json" -Body $body
```

### 3.2 Login de usuario
```powershell
$body = @{ email="usuario@empresa.com"; password="ClaveSegura1!!" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/auth/login" -ContentType "application/json" -Body $body
```

### 3.3 Ver logs de backend
```powershell
docker compose logs --tail=80 backend
```

---

## 4) Lo que resolvimos en esta sesion

### Problema A: `connection refused` al conectar desde pgAdmin
- Causa: Postgres no estaba expuesto al host o pgAdmin en contenedor usando host incorrecto.
- Solucion:
  - Exponer `5432:5432` en `docker-compose.yml` para `postgres`.
  - En pgAdmin contenedor, usar `host.docker.internal` (no `localhost`).

### Problema B: `password authentication failed for user "nexus"`
- Causa 1: `DATABASE_URL` en `.env` seguia con password vieja (`change-me`).
- Causa 2: Se mezclo password URL-encoded (`%40`) en un contexto SQL.
- Solucion:
  - En SQL (`ALTER USER`), usar password real con `@` normal.
  - En `DATABASE_URL`, usar URL-encoding para caracteres especiales (`@` -> `%40`).
  - Re-crear/reiniciar backend para que relea variables.

### Problema C: Login 401 con usuario existente
- Causa: credenciales de app no coincidian con las usadas al registrar.
- Solucion:
  - Verificar login por API.
  - En entorno dev, borrar y recrear usuario si no se recuerda password.

---

## 5) Reglas rapidas para no romper auth + BD
- `POSTGRES_PASSWORD` es password del motor Postgres (no del usuario de la app).
- Password del usuario app se define al registrar por `/api/auth/register`.
- `DATABASE_URL` siempre debe reflejar password real de BD y estar URL-encoded si aplica.
- `docker compose restart backend` no siempre refresca env viejo en todos los casos; si dudas, usar recreate:
```powershell
docker compose up -d --force-recreate backend
```


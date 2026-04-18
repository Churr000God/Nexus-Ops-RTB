# Sesion: Sprint 1 Backend — Alembic + Auth JWT + Refresh Token Opaco

**Fecha:** 2026-04-18
**Agente:** GPT-5.2 (Trae)
**Area:** backend
**Sprint:** 1
**Duracion aprox:** —

## Objetivo
Completar el Sprint 1 (backend) para tener cimientos funcionales: migraciones con Alembic y autenticacion con JWT + refresh token opaco en base de datos, incluyendo CORS y logging.

## Contexto Previo
- Existia un backend minimo con FastAPI y un router de health.
- No existia Alembic, modelos, schemas, services ni auth.
- Docker Compose dependia de un `.env` que no existia en el workspace (solo `.env.example`).

## Trabajo Realizado
- Se agregaron dependencias de backend para auth, migraciones, logging y tooling.
- Se implemento capa de DB async (SQLAlchemy async) y modelos `User` y `RefreshToken` (1 refresh activo por usuario).
- Se configuro Alembic (async env) y se creo la migracion inicial de `users` y `refresh_tokens`.
- Se implemento auth service + router:
  - `POST /api/auth/register`
  - `POST /api/auth/login` (set-cookie refresh HttpOnly)
  - `POST /api/auth/refresh` (rota refresh + nuevo access)
  - `POST /api/auth/logout` (revoca refresh)
  - `GET /api/auth/me`
- Se agregaron middleware de CORS, logging y contexto de auth (bearer).
- Se creo `.env` basado en `.env.example` para poder ejecutar docker compose y migraciones localmente.

## Decisiones Tomadas
- Refresh token opaco en DB y rotacion por seguridad y revocacion simple (sin overhead mental).
- 1 refresh activo por usuario (Sprint 1) asegurado por constraint unique en `refresh_tokens.user_id`.
- SQLAlchemy async desde el inicio para alinear el stack con endpoints async.
- Cookie refresh con `Secure=false` en `ENV=development` y `Secure=true` en otros entornos.
- Dependencias de tooling (ruff/mypy/pytest) en un solo `requirements.txt` por simplicidad.

## Errores Encontrados
- ERR-0001: Settings fallo parseando `ALLOWED_ORIGINS` desde env → resuelto con parsing propio en settings.
- ERR-0002: Incompatibilidad `passlib` + `bcrypt` (bcrypt 5.x) → resuelto fijando `bcrypt==3.2.2`.
- ERR-0003: `POST /logout` respondia con status_code None en algunos casos → resuelto retornando `Response(204)` explicito.

## Lecciones Aprendidas
- Pydantic Settings puede intentar interpretar listas desde env como JSON; para listas CSV conviene modelar como `str` y parsear manualmente.
- La combinacion `passlib[bcrypt]` requiere pinning cuidadoso de la version de `bcrypt` para evitar fallas runtime.
- Para endpoints 204 es preferible devolver un `Response(status_code=204)` para evitar inconsistencias en middleware/servidor.

## Archivos Modificados
- `backend/app/config.py` — settings (CORS, cookie secure, expiraciones).
- `backend/app/db.py` — engine/session async.
- `backend/app/models/*` — modelos Base/User/RefreshToken.
- `backend/alembic/*` y `backend/alembic.ini` — alembic + migracion inicial.
- `backend/app/services/auth_service.py` — logica de auth/refresh.
- `backend/app/schemas/auth_schema.py` — schemas y validaciones.
- `backend/app/routers/auth.py` — endpoints auth.
- `backend/app/dependencies.py` — get_db/get_current_user/roles + decode bearer.
- `backend/app/middleware/*` — CORS/logging/auth context.
- `backend/app/main.py` — registro de routers y middlewares.
- `.env.example` / `.env` — variables de entorno para dev.

## Siguiente Paso
Iniciar Sprint 2 (dashboard general + ventas) sobre la base de auth/migraciones ya establecida.

# Sesion: Troubleshooting de conexion PostgreSQL y login auth

**Fecha:** 2026-04-18
**Agente:** GPT-5.2 (Trae)
**Area:** backend
**Sprint:** 1
**Duracion aprox:** —

## Objetivo
Resolver fallas de conexion a PostgreSQL desde interfaz visual y corregir errores de auth (`/api/auth/register` y `/api/auth/login`) en entorno Docker.

## Contexto Previo
- Backend y frontend levantados con Docker.
- Se agrego exposicion de puerto `5432` para acceso a Postgres desde host.
- Usuario reporto:
  - `connection refused` desde pgAdmin
  - `password authentication failed for user "nexus"`
  - `Internal Server Error` en registro y `401` en login.

## Trabajo Realizado
- Se valido estado de contenedores y puertos publicados (`docker compose ps`, `docker compose port`, `Test-NetConnection`).
- Se confirmo que pgAdmin en contenedor debia usar `host.docker.internal` en lugar de `localhost`.
- Se actualizo password del rol `nexus` por SQL dentro del contenedor.
- Se detecto desalineacion entre `POSTGRES_PASSWORD` y `DATABASE_URL`.
- Se explico y aplico regla de URL-encoding en `DATABASE_URL` (`@` -> `%40`) sin usar encoding en SQL.
- Se reinicio/recreo backend para tomar variables nuevas.
- Se verifico que `register` retornara `201` y que los `401` de login fueran por credenciales app.

## Decisiones Tomadas
- Mantener `postgres` accesible por `5432` para facilitar administracion con UI en dev.
- Documentar una guia operativa de BD para evitar repetir troubleshooting.
- Diferenciar explicitamente password de motor Postgres vs password de usuarios de aplicacion.

## Errores Encontrados
- Conexion rechazada en pgAdmin por host incorrecto cuando corre en contenedor.
- Falla de autenticacion de BD por credenciales desalineadas entre `.env` y rol real.
- Uso incorrecto de password URL-encoded en comando SQL `ALTER USER`.

## Lecciones Aprendidas
- `localhost` dentro de un contenedor no apunta al host; usar `host.docker.internal` o misma red Docker.
- Cambiar `.env` no siempre resuelve por si solo: hay que alinear estado real de la BD y reiniciar/recrear servicios.
- URL-encoding aplica a `DATABASE_URL`, no a comandos SQL.

## Archivos Modificados
- `docker-compose.yml` — exposicion de `5432:5432` en servicio `postgres`.
- `GUIA_BD_POSTGRES.md` — comandos y troubleshooting operativo.

## Siguiente Paso
Mejorar mensajes de error de login en frontend para mostrar `detail` real del backend en lugar de mensaje generico.


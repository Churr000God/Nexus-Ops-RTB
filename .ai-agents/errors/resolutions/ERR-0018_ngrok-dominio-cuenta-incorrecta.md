# ERR-0018: Contenedor ngrok se reinicia constantemente por dominio de otra cuenta

**Fecha:** 2026-04-25
**Area:** docker
**Severidad:** medio
**Estado:** resuelto

## Descripcion
El contenedor `ngrok` entraba en bucle de reinicios infinitos (`Restarting (1)`). Error en logs:

```
ERROR: ERR_NGROK_320
ERROR: failed to start tunnel: This domain is reserved for another account.
ERROR: Failed to create an endpoint with the domain 'caress-shortlist-disarm.ngrok-free.dev'
       for the account 'dhguilleng@gmail.com'.
```

## Contexto
El dominio fijo `caress-shortlist-disarm.ngrok-free.dev` estaba hardcodeado en `docker-compose.yml`. Como ngrok salía con exit code 1 y la política era `restart: unless-stopped`, Docker lo reiniciaba indefinidamente.

## Causa Raiz
El dominio `caress-shortlist-disarm.ngrok-free.dev` pertenecía a otra cuenta de ngrok distinta a la asociada con el `NGROK_AUTHTOKEN` configurado en `.env`. Ngrok rechaza el inicio si el dominio solicitado no está reservado bajo la cuenta del authtoken.

## Solucion
Actualizar el dominio en `docker-compose.yml` con el dominio correcto de la cuenta activa:

```yaml
# Antes
command: http --url=caress-shortlist-disarm.ngrok-free.dev --pooling-enabled proxy:80

# Después
command: http --url=pouncing-shoplift-politely.ngrok-free.dev --pooling-enabled proxy:80
```

Luego reiniciar el contenedor:
```bash
docker compose up -d ngrok
```

## Prevencion
- El dominio ngrok debe estar reservado en `https://dashboard.ngrok.com/domains` bajo la misma cuenta que el `NGROK_AUTHTOKEN` del `.env`.
- Al rotar el authtoken o cambiar de cuenta, verificar que el dominio en `docker-compose.yml` sea el que aparece en el dashboard de la cuenta nueva.

## Archivos Afectados
- `docker-compose.yml` — dominio ngrok actualizado de `caress-shortlist-disarm` a `pouncing-shoplift-politely`

## Referencias
- https://ngrok.com/docs/errors/err_ngrok_320
- https://dashboard.ngrok.com/domains/new

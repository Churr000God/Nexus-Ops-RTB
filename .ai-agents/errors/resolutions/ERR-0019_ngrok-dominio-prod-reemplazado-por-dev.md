# ERR-0019: Fix de ERR-0018 reemplazó el dominio de producción con el de desarrollo

**Fecha:** 2026-04-25
**Area:** docker
**Severidad:** medio
**Estado:** resuelto

## Descripcion

El contenedor `ngrok` se reiniciaba en bucle en producción con el error `ERR_NGROK_320`:

```
ERROR: failed to start tunnel: This domain is reserved for another account.
ERROR: Failed to create an endpoint with the domain
       'pouncing-shoplift-politely.ngrok-free.dev'
       for the account 'Diego Hermilo Guillen Garcia'.
```

## Contexto

Al resolver ERR-0018 se cambió el dominio de ngrok en `docker-compose.yml` de
`caress-shortlist-disarm.ngrok-free.dev` a `pouncing-shoplift-politely.ngrok-free.dev`.
El error pareció resolverse porque el entorno de desarrollo (otra máquina, otra cuenta ngrok)
usaba `pouncing-shoplift-politely` correctamente. Sin embargo, en producción (Raspberry Pi,
cuenta `dhguilleng`) ese dominio pertenece a una cuenta diferente.

## Causa Raiz

Confusión entre dominios de los dos entornos:

| Entorno | Dominio ngrok | Cuenta |
|---------|--------------|--------|
| **Producción** (Raspberry Pi) | `caress-shortlist-disarm.ngrok-free.dev` | dhguilleng |
| **Desarrollo** (otra máquina) | `pouncing-shoplift-politely.ngrok-free.dev` | otra cuenta |

El fix de ERR-0018 identificó `caress-shortlist-disarm` como "dominio de otra cuenta" cuando
en realidad era el dominio correcto de producción. Lo reemplazó con el dominio de desarrollo,
que sí pertenece a otra cuenta desde el punto de vista del servidor de producción.

## Solucion

Revertir `docker-compose.yml` al dominio correcto de producción y agregar un comentario
que documente explícitamente a qué entorno pertenece cada dominio:

```yaml
# Dominio de PRODUCCION (cuenta dhguilleng). Dev usa pouncing-shoplift-politely (otra cuenta).
command: http --domain=caress-shortlist-disarm.ngrok-free.dev proxy:80
```

## Prevencion

- El comentario en `docker-compose.yml` deja claro que `caress-shortlist-disarm` es de producción.
- Ante errores `ERR_NGROK_320`, verificar primero en `dashboard.ngrok.com/domains` qué dominio
  está asociado a la cuenta antes de cambiarlo.
- No asumir que el dominio que funciona en dev es el correcto para prod: son cuentas distintas.

## Archivos Afectados

- `docker-compose.yml` — dominio revertido a `caress-shortlist-disarm.ngrok-free.dev` + comentario

## Referencias

- ERR-0018: error original de ngrok que introdujo este problema
- https://ngrok.com/docs/errors/err_ngrok_320

# ERR-0002: passlib/bcrypt incompatible (bcrypt 5.x) rompe hashing

**Fecha:** 2026-04-18
**Area:** backend
**Severidad:** alto
**Estado:** resuelto

## Descripcion
Durante `POST /api/auth/register` o al probar hashing directo se produjo fallo en bcrypt:

- `(trapped) error reading bcrypt version`
- `AttributeError: module 'bcrypt' has no attribute '__about__'`
- El flujo terminaba en error al hashear/verificar contrasenas.

## Contexto
- Se uso `passlib[bcrypt]` para hashing de contrasenas.
- El contenedor instalo `bcrypt` 5.x (transitivo) y passlib no pudo leer version/compat.

## Causa Raiz
Cambios en el paquete `bcrypt` (5.x) y su metadata interna rompen deteccion/compatibilidad usada por `passlib`.

## Solucion
- Fijar explicitamente una version compatible: `bcrypt==3.2.2` en `backend/requirements.txt`.
- Rebuild del contenedor backend.

## Prevencion
- Pin de dependencias criticas de seguridad (bcrypt/cryptography/jose) en proyectos dockerizados para evitar cambios transitivos.

## Archivos Afectados
- `backend/requirements.txt` — agregado pin `bcrypt==3.2.2`.

## Referencias
- passlib + bcrypt incompatibilidad: sintomas comunes al mezclar passlib con bcrypt moderno.

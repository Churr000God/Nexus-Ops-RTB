# ERR-0006: docker build frontend falla — TS2322 string|null no asignable a string|undefined

**Fecha:** 2026-04-21
**Area:** frontend
**Severidad:** bajo
**Estado:** resuelto

## Descripcion
`docker compose build --no-cache frontend` falla durante `npm run build` con:

```
src/components/dashboards/VentasDashboard.tsx(189,59): error TS2322: Type 'string | null' is not assignable to type 'string | undefined'.
src/components/dashboards/VentasDashboard.tsx(189,70): error TS2322: Type 'string | null' is not assignable to type 'string | undefined'.
```

## Contexto
Se ejecutó un build sin cache. El error estaba latente pero solo se detecta en el build de producción (tsc en modo estricto).

## Causa Raiz
`startDate` y `endDate` en `VentasDashboard.tsx` son `string | null` (vienen de `useState<string | null>`). La función `ventasService.productsByCustomerType` espera `{ startDate?: string; endDate?: string }` (es decir, `string | undefined`). TypeScript estricto no acepta `null` donde se espera `undefined`.

## Solucion
En `VentasDashboard.tsx:189`, convertir `null` a `undefined` usando el operador `?? undefined`:

```ts
// Antes
ventasService.productsByCustomerType(token ?? "", { startDate, endDate }, signal)

// Después
ventasService.productsByCustomerType(token ?? "", { startDate: startDate ?? undefined, endDate: endDate ?? undefined }, signal)
```

## Prevencion
- Correr `npx tsc --noEmit` localmente antes de hacer build de Docker para detectar errores de tipo anticipadamente
- Cuando un servicio declara params opcionales como `param?: string`, asegurarse de pasar `value ?? undefined` si el valor de estado local es `string | null`

## Archivos Afectados
- `frontend/src/components/dashboards/VentasDashboard.tsx:189` — conversión null→undefined en params del service call

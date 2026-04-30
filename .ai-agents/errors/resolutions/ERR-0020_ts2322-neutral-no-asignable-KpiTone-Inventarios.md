# ERR-0020: TS2322 — `"neutral"` no asignable a `KpiTone` en Inventarios.tsx rompe docker build

**Fecha:** 2026-04-29
**Area:** frontend
**Severidad:** medio
**Estado:** resuelto

## Descripcion

El build del contenedor frontend falló con código de salida 1:

```
src/pages/Inventarios.tsx(78,3): error TS2322: Type '"neutral"' is not assignable to type 'KpiTone'.
```

El build del backend fue cancelado como consecuencia (Compose aborta ambos en fallo de cualquiera).

## Contexto

`Inventarios.tsx` define su propio componente `KpiCard` inline (no importa el de `@/components/common/KpiCard`). El tipo local `KpiTone` era:

```ts
type KpiTone = "green" | "red" | "amber" | "blue" | "violet"
```

Pero el parámetro `tone` en el componente usaba `"neutral"` como valor por defecto:

```ts
tone = "neutral",
```

TypeScript rechazó la asignación porque `"neutral"` no estaba en el union type.

## Causa Raiz

Cambios sin stagear en el working tree introdujeron el valor por defecto `"neutral"` al componente `KpiCard` local, pero no agregaron `"neutral"` al tipo `KpiTone` ni a los tres mapas de estilos (`KPI_TONE`, `KPI_ICON_TONE`, `KPI_VALUE_TONE`). HEAD ya tenía el código correcto; los cambios del working tree rompían el build al momento de ejecutar `docker compose up --build`.

## Solucion

Agregar `"neutral"` al tipo local y sus entradas de estilos slate en los tres mapas:

```ts
type KpiTone = "green" | "red" | "amber" | "blue" | "violet" | "neutral"

const KPI_TONE: Record<KpiTone, string> = {
  ...
  neutral: "border-slate-500/30 bg-slate-500/10",
}
const KPI_ICON_TONE: Record<KpiTone, string> = {
  ...
  neutral: "text-slate-400",
}
const KPI_VALUE_TONE: Record<KpiTone, string> = {
  ...
  neutral: "text-slate-300",
}
```

La edición restauró el working tree al estado de HEAD — sin nuevo commit requerido en el código.

## Prevencion

- Correr `npm run tsc --noEmit` (o `tsc -b`) localmente antes de lanzar el build de Docker.
- Al agregar un valor por defecto a un prop tipado con union literal, verificar que el valor esté en el union Y en todos los `Record<KpiTone, ...>` asociados.
- El componente `KpiCard` compartido en `@/components/common/KpiCard.tsx` ya incluye `"neutral"`. Si se necesitan más tonos en páginas concretas, considerar importar el componente compartido en lugar de duplicarlo.

## Archivos Afectados

- `frontend/src/pages/Inventarios.tsx` — agregado `"neutral"` a `KpiTone` y tres mapas de estilos (líneas 47–71)

## Referencias

- Componente compartido de referencia: `frontend/src/components/common/KpiCard.tsx` (línea 8 — `KpiTone` incluye `"neutral"`)

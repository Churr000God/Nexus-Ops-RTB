# ERR-0010: Dropdown de sugerencias se cerraba antes de registrar el click del usuario

**Fecha:** 2026-04-21
**Area:** frontend
**Severidad:** medio
**Estado:** resuelto

## Descripcion
El dropdown de autocompletado de clientes se cerraba inmediatamente al intentar seleccionar una sugerencia, sin ejecutar la seleccion. El usuario hacia click pero el dropdown desaparecia y el input no se actualizaba.

## Contexto
Componente `CustomerSearchInput`. El dropdown se ocultaba con `showDropdown = false` al detectar `blur` en el input. El problema: el evento `blur` en el `<input>` se dispara ANTES que `click` en el boton de sugerencia (orden de eventos del browser: `mousedown → blur → focus → mouseup → click`).

## Causa Raiz
El handler de `onBlur` del input llamaba `setShowDropdown(false)`. Al hacer click en una sugerencia, el browser disparaba `blur` en el input primero, lo que ocultaba el dropdown, y luego el `click` en la sugerencia ya no encontraba el elemento en el DOM (o no se disparaba porque el elemento fue desmontado).

## Solucion
Dos cambios en combinacion:

1. **`onMouseDown={(e) => e.preventDefault()}`** en cada boton de sugerencia: previene que el browser cambie el foco (y dispare `blur`) al hacer mousedown sobre la sugerencia.

2. **Click-outside con `mousedown` en document** en lugar de `onBlur` en el input:
```tsx
useEffect(() => {
  const handler = (e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setShowDropdown(false)
    }
  }
  document.addEventListener("mousedown", handler)
  return () => document.removeEventListener("mousedown", handler)
}, [])
```

## Prevencion
Para cualquier patron "input + dropdown de sugerencias" en React:
- Nunca cerrar el dropdown en `onBlur` del input.
- Siempre usar `onMouseDown + preventDefault` en los items del dropdown.
- Cerrar con listener de `mousedown` en document + `containerRef.contains()`.

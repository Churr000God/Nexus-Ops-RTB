# ERR-0011: PostgreSQL coloca NULLs primero en ORDER BY DESC por defecto

**Fecha:** 2026-04-21
**Area:** backend + db
**Severidad:** medio
**Estado:** resuelto

## Descripcion
Al ordenar por `qty_packed DESC` en la consulta de productos mas vendidos, los productos sin cantidad empacada (NULL) aparecian en las primeras posiciones en lugar de al final.

## Contexto
Consulta en `ventas_service.py` (metodo `products_by_customer_type` y consulta ad-hoc de top productos por qty_packed):
```sql
ORDER BY SUM(ci.qty_packed) DESC  -- NULLs aparecen primero
```

## Causa Raiz
El estandar SQL y la implementacion de PostgreSQL colocan `NULL` como el valor "mayor" en orden descendente: `DESC` equivale a `DESC NULLS FIRST`. Esto significa que filas con `NULL` en la columna de orden aparecen antes que cualquier valor numerico.

## Solucion
Agregar `NULLS LAST` explicitamente:
```sql
ORDER BY SUM(ci.qty_packed) DESC NULLS LAST
```

Y usar `COALESCE` para que el SUM no propague NULL cuando todos los items son NULL:
```sql
COALESCE(SUM(ci.qty_packed), 0)
```

## Prevencion
En cualquier `ORDER BY ... DESC` sobre campos que puedan ser NULL en PostgreSQL, agregar siempre `NULLS LAST`. El comportamiento contrario (`ASC NULLS FIRST`) tampoco suele ser deseable; la convencion segura es:
- `ORDER BY campo DESC NULLS LAST`
- `ORDER BY campo ASC NULLS LAST`

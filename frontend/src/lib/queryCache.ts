export const STALE = {
  SHORT: 30_000,
  MEDIUM: 90_000,
  LONG: 5 * 60_000,
  CATALOG: 60 * 60_000,
} as const

export const TTL = {
  DAY: 24 * 60 * 60_000,
  WEEK: 7 * 24 * 60 * 60_000,
} as const

export const CACHE_KEYS = {
  PRODUCTOS: "productos",
  CLIENTES: "clientes",
  PROVEEDORES: "proveedores",
  COTIZACIONES: "cotizaciones",
  NOTAS_REMISION: "notas-remision",
  CATEGORIAS: "categorias",
  MARCAS: "marcas",
  CARRIERS: "carriers",
  SAT_CLAVES: "sat-claves",
  INVENTARIO: "inventario",
  PEDIDOS: "pedidos",
} as const

const LS_PREFIX = "nexus-cache:"

type MemEntry = { data: unknown; ts: number }
type LsEntry = { data: unknown; ts: number; ttl: number }

const memCache = new Map<string, MemEntry>()

export function cacheGet<T>(key: string, staleTime: number): T | null {
  const now = Date.now()

  const mem = memCache.get(key)
  if (mem && now - mem.ts < staleTime) {
    return mem.data as T
  }

  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (raw) {
      const entry: LsEntry = JSON.parse(raw) as LsEntry
      if (now - entry.ts < entry.ttl) {
        memCache.set(key, { data: entry.data, ts: entry.ts })
        return entry.data as T
      }
      localStorage.removeItem(LS_PREFIX + key)
    }
  } catch {
    // localStorage unavailable or parse error — treat as cache miss
  }

  return null
}

export function cacheSet<T>(key: string, data: T, opts?: { ttl?: number }): void {
  const ts = Date.now()
  memCache.set(key, { data, ts })

  if (opts?.ttl !== undefined) {
    try {
      const entry: LsEntry = { data, ts, ttl: opts.ttl }
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry))
    } catch {
      // Quota exceeded or private browsing — silently skip persistence
    }
  }
}

export function cacheInvalidate(key: string): void {
  memCache.delete(key)
  try {
    localStorage.removeItem(LS_PREFIX + key)
  } catch {
    // ignore
  }
}

export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of memCache.keys()) {
    if (key.startsWith(prefix)) {
      memCache.delete(key)
    }
  }

  try {
    const lsPrefix = LS_PREFIX + prefix
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(lsPrefix)) {
        toRemove.push(k)
      }
    }
    for (const k of toRemove) {
      localStorage.removeItem(k)
    }
  } catch {
    // ignore
  }
}

import { useEffect, useRef } from "react"

import type { CustomerSearchItem } from "@/types/ventas"

type Props = {
  query: string
  onQueryChange: (q: string) => void
  suggestions: CustomerSearchItem[]
  loading: boolean
  selectedCustomer: CustomerSearchItem | null
  onSelect: (item: CustomerSearchItem) => void
  onClear: () => void
}

export function PaymentCustomerSearch({
  query,
  onQueryChange,
  suggestions,
  loading,
  selectedCustomer,
  onSelect,
  onClear,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const showDropdown = query.length >= 2 && !selectedCustomer && suggestions.length > 0

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // blur fuera — no cerramos el dropdown aquí, lo maneja onSelect
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={containerRef} className="relative mb-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar cliente por nombre o ID externo…"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {loading && query.length >= 2 && !selectedCustomer && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              Buscando…
            </span>
          )}
        </div>
        {(query || selectedCustomer) && (
          <button
            onClick={onClear}
            className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Limpiar
          </button>
        )}
        {selectedCustomer && (
          <span className="text-xs text-muted-foreground">
            {selectedCustomer.external_id ? `ID: ${selectedCustomer.external_id}` : ""}
          </span>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-10 mt-1 w-full max-w-sm rounded-md border border-border bg-card shadow-lg">
          {suggestions.map((item) => (
            <button
              key={item.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(item)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span className="truncate font-medium">{item.name}</span>
              {item.external_id && (
                <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                  {item.external_id}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

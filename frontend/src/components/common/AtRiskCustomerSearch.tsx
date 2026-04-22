import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { AtRiskCustomer } from "@/types/ventas"
import { formatCurrencyMXN } from "@/lib/utils"

type Props = {
  customers: AtRiskCustomer[]
  selected: AtRiskCustomer | null
  onSelect: (customer: AtRiskCustomer | null) => void
}

const RISK_COLOR: Record<string, string> = {
  Crítico: "text-red-600",
  Alto: "text-orange-500",
  Medio: "text-yellow-600",
}

export function AtRiskCustomerSearch({ customers, selected, onSelect }: Props) {
  const [inputValue, setInputValue] = useState(selected?.customer_name ?? "")
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selected === null) setInputValue("")
    else setInputValue(selected.customer_name)
  }, [selected])

  const suggestions = useMemo(() => {
    const q = inputValue.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) =>
        c.customer_name.toLowerCase().includes(q) ||
        (c.external_id ?? "").toLowerCase().includes(q)
    )
  }, [customers, inputValue])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setShowDropdown(true)
    onSelect(null)
  }, [onSelect])

  const handleSelect = useCallback(
    (customer: AtRiskCustomer) => {
      setShowDropdown(false)
      onSelect(customer)
    },
    [onSelect]
  )

  const handleClear = useCallback(() => {
    setInputValue("")
    setShowDropdown(false)
    onSelect(null)
  }, [onSelect])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={containerRef} className="relative mb-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={handleChange}
            onFocus={() => setShowDropdown(true)}
            placeholder="Buscar cliente por nombre o ID externo…"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {(inputValue || selected) && (
          <button
            onClick={handleClear}
            className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Limpiar
          </button>
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
          {suggestions.map((c) => (
            <button
              key={c.customer_id ?? c.customer_name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(c)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.customer_name}</span>
                {c.external_id && (
                  <span className="block text-[11px] text-muted-foreground">
                    ID: {c.external_id}
                  </span>
                )}
              </div>
              <div className="ml-3 flex shrink-0 flex-col items-end gap-0.5">
                <span className={`text-[11px] font-semibold ${RISK_COLOR[c.riesgo_abandono] ?? "text-muted-foreground"}`}>
                  {c.riesgo_abandono}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {formatCurrencyMXN(c.compras_ult_90)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

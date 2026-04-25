import { useCallback, useEffect, useRef, useState } from "react"

import { formatCurrencyMXN, formatNumber } from "@/lib/utils"

type ProductSuggestion = {
  product: string
  sku: string | null
  qty?: number
  revenue?: number
}

type Props = {
  suggestions: ProductSuggestion[]
  loading: boolean
  onSearch: (value: string) => void
  onSelect: (sku: string | null, name: string) => void
  selectedProduct: string | null
}

export function ProductSearchInput({
  suggestions,
  loading,
  onSearch,
  onSelect,
  selectedProduct,
}: Props) {
  const [inputValue, setInputValue] = useState(selectedProduct ?? "")
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedProduct === null) {
      const timeoutId = window.setTimeout(() => {
        setInputValue("")
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }
  }, [selectedProduct])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setInputValue(val)
      setShowDropdown(true)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSearch(val.trim())
      }, 300)
    },
    [onSearch]
  )

  const handleSelect = useCallback(
    (sku: string | null, name: string) => {
      setInputValue(name)
      setShowDropdown(false)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      onSelect(sku, name)
    },
    [onSelect]
  )

  const handleClear = useCallback(() => {
    setInputValue("")
    setShowDropdown(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    onSearch("")
    onSelect(null, "")
  }, [onSearch, onSelect])

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
    <div ref={containerRef} className="relative mb-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={handleChange}
            onFocus={() => inputValue && setShowDropdown(true)}
            placeholder="Buscar producto por nombre o SKU…"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {loading && inputValue && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              Buscando…
            </span>
          )}
        </div>
        {inputValue && (
          <button
            onClick={handleClear}
            className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Limpiar
          </button>
        )}
      </div>

      {showDropdown && inputValue && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
          {suggestions.slice(0, 8).map((row) => (
            <button
              key={row.sku ?? row.product}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(row.sku, row.product)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate font-medium">{row.product}</span>
                {row.sku && (
                  <span className="block text-[11px] text-muted-foreground">SKU: {row.sku}</span>
                )}
              </div>
              <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                {row.qty !== undefined && `${formatNumber(row.qty)} pz`}
                {row.qty !== undefined && row.revenue !== undefined && " · "}
                {row.revenue !== undefined && formatCurrencyMXN(row.revenue)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

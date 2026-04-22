import { useCallback, useEffect, useRef, useState } from "react"

import { formatCurrencyMXN } from "@/lib/utils"

type Suggestion = {
  customer: string
  category: string
  revenue: number
}

type Props = {
  suggestions: Suggestion[]
  loading: boolean
  onSearch: (value: string) => void
}

export function CustomerSearchInput({ suggestions, loading, onSearch }: Props) {
  const [inputValue, setInputValue] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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
    (name: string) => {
      setInputValue(name)
      setShowDropdown(false)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      onSearch(name)
    },
    [onSearch]
  )

  const handleClear = useCallback(() => {
    setInputValue("")
    setShowDropdown(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    onSearch("")
  }, [onSearch])

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
            placeholder="Buscar cliente por nombre…"
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
              key={row.customer}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(row.customer)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span className="truncate font-medium">{row.customer}</span>
              <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                {row.category} · {formatCurrencyMXN(row.revenue)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

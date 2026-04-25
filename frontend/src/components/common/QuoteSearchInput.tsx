import { useCallback, useEffect, useRef, useState } from "react"

import { formatIsoDate } from "@/lib/utils"

type QuoteSuggestion = {
  id: string
  name: string
  customer_name: string | null
  po_pr: string | null
  created_on: string | null
}

type Props = {
  suggestions: QuoteSuggestion[]
  loading: boolean
  onSearch: (value: string) => void
  onSelect: (id: string | null) => void
  selectedQuoteId: string | null
}

export function QuoteSearchInput({
  suggestions,
  loading,
  onSearch,
  onSelect,
  selectedQuoteId,
}: Props) {
  const [inputValue, setInputValue] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedQuoteId === null) {
      const timeoutId = window.setTimeout(() => {
        setInputValue("")
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }
  }, [selectedQuoteId])

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
    (id: string, name: string) => {
      setInputValue(name)
      setShowDropdown(false)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      onSelect(id)
    },
    [onSelect]
  )

  const handleClear = useCallback(() => {
    setInputValue("")
    setShowDropdown(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    onSearch("")
    onSelect(null)
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
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={handleChange}
            onFocus={() => inputValue && setShowDropdown(true)}
            placeholder="Buscar cotización, cliente o PO…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
            className="rounded-md border border-border px-2 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Limpiar
          </button>
        )}
      </div>

      {showDropdown && inputValue && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-w-md rounded-md border border-border bg-card shadow-lg">
          {suggestions.slice(0, 8).map((row) => (
            <button
              key={row.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(row.id, row.name)}
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <div className="flex items-center justify-between">
                <span className="truncate font-medium">{row.name}</span>
                <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">
                  {row.created_on ? formatIsoDate(row.created_on) : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{row.customer_name ?? "Sin cliente"}</span>
                {row.po_pr ? <span>· PO {row.po_pr}</span> : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

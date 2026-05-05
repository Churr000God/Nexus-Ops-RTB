import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, Package, Search, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { productosService } from "@/services/productosService"
import { assetsService } from "@/services/assetsService"
import { useAuthStore } from "@/stores/authStore"
import type { ProductRead } from "@/types/productos"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const TODAY = new Date().toISOString().slice(0, 10)

export function AjusteModal({ open, onClose, onSaved }: Props) {
  const token = useAuthStore((s) => s.accessToken)

  // product search
  const [searchText, setSearchText] = useState("")
  const [suggestions, setSuggestions] = useState<ProductRead[]>([])
  const [searching, setSearching] = useState(false)
  const [showDrop, setShowDrop] = useState(false)
  const [selected, setSelected] = useState<ProductRead | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // form fields
  const [direction, setDirection] = useState<"in" | "out">("in")
  const [quantity, setQuantity] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [observations, setObservations] = useState("")
  const [movedOn, setMovedOn] = useState(TODAY)
  const [saving, setSaving] = useState(false)

  const reset = useCallback(() => {
    setSearchText("")
    setSuggestions([])
    setShowDrop(false)
    setSelected(null)
    setDirection("in")
    setQuantity("")
    setUnitCost("")
    setObservations("")
    setMovedOn(TODAY)
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  // close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDrop(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleSearch = useCallback(
    (val: string) => {
      setSearchText(val)
      setSelected(null)
      setShowDrop(true)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (!val.trim()) {
        setSuggestions([])
        return
      }
      debounceRef.current = setTimeout(async () => {
        setSearching(true)
        try {
          const res = await productosService.listProducts(token, { search: val.trim(), limit: 8 })
          setSuggestions(res.items)
        } catch {
          setSuggestions([])
        } finally {
          setSearching(false)
        }
      }, 300)
    },
    [token],
  )

  const handleSelect = (p: ProductRead) => {
    setSelected(p)
    setSearchText(`${p.sku ? `[${p.sku}] ` : ""}${p.name}`)
    setShowDrop(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) {
      toast.error("Selecciona un producto")
      return
    }
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0) {
      toast.error("La cantidad debe ser mayor a 0")
      return
    }
    if (!observations.trim()) {
      toast.error("Las observaciones son requeridas")
      return
    }
    setSaving(true)
    try {
      await assetsService.createAdjustment(token, {
        product_id: selected.id,
        direction,
        quantity: qty,
        unit_cost: unitCost ? parseFloat(unitCost) : null,
        observations: observations.trim(),
        moved_on: movedOn || null,
      })
      toast.success("Ajuste registrado correctamente")
      onSaved()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrar ajuste"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-[hsl(var(--primary))]" />
            <h2 className="text-base font-semibold text-foreground">Nuevo Ajuste de Inventario</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Product search */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Producto *
            </label>
            <div ref={searchRef} className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchText && !selected && setShowDrop(true)}
                placeholder="Buscar por nombre o SKU…"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  Buscando…
                </span>
              )}
              {showDrop && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                  {suggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(p)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{p.name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {p.sku ?? "Sin SKU"} ·{" "}
                          {p.is_saleable ? "Vendible" : "Interno"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selected && (
              <p className="mt-1 text-xs text-muted-foreground">
                {selected.is_saleable ? "Vendible" : "Interno"} ·{" "}
                {selected.category ?? "Sin categoría"}
              </p>
            )}
          </div>

          {/* Direction toggle */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Tipo de ajuste *
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection("in")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  direction === "in"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                    : "border-input bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                <ArrowUp className="h-4 w-4" />
                Entrada
              </button>
              <button
                type="button"
                onClick={() => setDirection("out")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  direction === "out"
                    ? "border-red-500 bg-red-500/10 text-red-600"
                    : "border-input bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                <ArrowDown className="h-4 w-4" />
                Salida
              </button>
            </div>
          </div>

          {/* Quantity + Unit cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Cantidad *
              </label>
              <input
                type="number"
                min="0.001"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Costo unitario (opcional)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="$0.00"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Fecha del ajuste
            </label>
            <input
              type="date"
              value={movedOn}
              onChange={(e) => setMovedOn(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Observations */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Observaciones *
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              placeholder="Motivo del ajuste (p. ej. corrección de conteo, merma, daño…)"
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar ajuste"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

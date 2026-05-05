import { useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { assetsService } from "@/services/assetsService"
import { productosService } from "@/services/productosService"
import { useAuthStore } from "@/stores/authStore"
import type { InstallComponentPayload } from "@/types/assets"
import type { ProductRead } from "@/types/productos"

interface InstallComponentModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  assetId: string
}

export function InstallComponentModal({
  open,
  onClose,
  onSuccess,
  assetId,
}: InstallComponentModalProps) {
  const token = useAuthStore((s) => s.accessToken)
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<ProductRead[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<ProductRead | null>(null)
  const [quantity, setQuantity] = useState("1")
  const [serialNumber, setSerialNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setSearch("")
      setResults([])
      setSelected(null)
      setQuantity("1")
      setSerialNumber("")
      setNotes("")
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!search.trim() || selected) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await productosService.listProducts(token, { search: search.trim(), limit: 10 })
        setResults(res.items ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [search, selected, token])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: InstallComponentPayload = {
        product_id: selected?.id ?? null,
        quantity: parseFloat(quantity) || 1,
        serial_number: serialNumber.trim() || null,
        notes: notes.trim() || null,
      }
      await assetsService.installComponent(token, assetId, payload)
      toast.success("Componente instalado correctamente")
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al instalar componente"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="surface-card w-full max-w-lg">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Instalar Componente</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Product search */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Producto del Catálogo
            </label>
            {selected ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-accent/20 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{selected.name}</p>
                  <p className="text-xs text-muted-foreground">SKU: {selected.sku ?? "—"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelected(null); setSearch("") }}
                  className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por SKU o nombre…"
                />
                {(results.length > 0 || searching) && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-border bg-background shadow-lg">
                    {searching ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Buscando…</p>
                    ) : (
                      results.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-accent"
                          onClick={() => { setSelected(p); setSearch("") }}
                        >
                          <p className="text-sm font-medium text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.sku ?? "Sin SKU"} · {p.category ?? "Sin categoría"}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Opcional. Si seleccionas un producto se descontará del stock de inventario.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Cantidad</label>
              <input
                type="number"
                min={0.01}
                step="any"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Número de Serie (del componente)
              </label>
              <input
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="SN-XXXXXXXX"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Notas</label>
            <textarea
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones de la instalación…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Instalando…" : "Instalar Componente"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

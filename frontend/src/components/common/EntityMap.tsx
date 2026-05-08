import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

export type GeoAddress = {
  street: string
  city: string | null
  state: string | null
  country: string
  zip_code: string | null
  is_approximate?: boolean
}

export type MapMarkerItem = {
  id: number
  name: string
  code: string
  isActive: boolean
  badge?: string
  badgeColor?: string
  extraInfo?: string[]
  address: GeoAddress | null
}

// Module-level cache survives re-renders and view switches
const geocodeCache = new Map<string, [number, number] | null>()
let lastFetchAt = 0

/** Builds candidate queries from best to worst specificity */
function buildQueries(addr: GeoAddress): string[] {
  const candidates: string[] = []
  const country = addr.country || "México"

  // Strategy 1: full address (city + state + country)
  if (addr.city && addr.state) {
    candidates.push([addr.city, addr.state, country].join(", "))
  }

  // Strategy 2: zip + city + country
  if (addr.zip_code && addr.city) {
    candidates.push([addr.zip_code, addr.city, country].join(", "))
  }

  // Strategy 3: city + country
  if (addr.city) {
    candidates.push([addr.city, country].join(", "))
  }

  // Strategy 4: zip + country  (main fallback for tax-data-only records)
  if (addr.zip_code) {
    candidates.push([addr.zip_code, country].join(", "))
  }

  // Strategy 5: state + country
  if (addr.state) {
    candidates.push([addr.state, country].join(", "))
  }

  return candidates
}

async function geocodeOne(addr: GeoAddress): Promise<[number, number] | null> {
  const queries = buildQueries(addr)
  if (queries.length === 0) return null

  for (const query of queries) {
    if (geocodeCache.has(query)) {
      const cached = geocodeCache.get(query) ?? null
      if (cached) return cached
      continue // cached null → try next strategy
    }

    // Nominatim policy: 1 request/second max
    const wait = Math.max(0, 1100 - (Date.now() - lastFetchAt))
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastFetchAt = Date.now()

    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=mx,us,ca`
      const res = await fetch(url)
      const data = (await res.json()) as Array<{ lat: string; lon: string }>

      if (data.length > 0) {
        const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)]
        geocodeCache.set(query, coords)
        return coords
      }
      geocodeCache.set(query, null)
      // fall through to next strategy
    } catch {
      geocodeCache.set(query, null)
    }
  }

  return null
}

function makeIcon(color: string, isActive: boolean, isApproximate: boolean): L.DivIcon {
  const opacity = isActive ? "1" : "0.45"
  // Approximate = dashed ring around pin
  const ring = isApproximate
    ? `<circle cx="13" cy="13" r="10" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="3 2" opacity="0.6"/>`
    : ""
  return L.divIcon({
    className: "",
    html: `
      <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
        <svg width="26" height="34" viewBox="0 0 26 34" fill="none" xmlns="http://www.w3.org/2000/svg"
          style="opacity:${opacity};filter:drop-shadow(0 2px 4px rgba(0,0,0,.45));">
          <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 21 13 21s13-11.25 13-21C26 5.82 20.18 0 13 0z" fill="${color}"/>
          <circle cx="13" cy="13" r="5" fill="white" fill-opacity="0.9"/>
          ${ring}
        </svg>
      </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 34],
    tooltipAnchor: [0, -34],
  })
}

function tooltipHtml(item: MapMarkerItem): string {
  const addr = item.address
  const isApprox = addr?.is_approximate ?? false

  const addrLine = addr
    ? [addr.city, addr.state].filter(Boolean).join(", ") ||
      (addr.zip_code ? `CP ${addr.zip_code}` : null)
    : null

  const badgeHtml = item.badge
    ? `<span style="
        display:inline-block;
        background:${item.badgeColor ?? "#3b82f6"}15;
        color:${item.badgeColor ?? "#3b82f6"};
        border:1px solid ${item.badgeColor ?? "#3b82f6"}40;
        border-radius:9999px;
        padding:2px 8px;font-size:10px;font-weight:600;margin-bottom:6px;
      ">${item.badge}</span>`
    : ""

  const extraHtml = (item.extraInfo ?? [])
    .map((l) => `<div style="font-size:11px;color:#64748b;margin-top:3px;">${l}</div>`)
    .join("")

  const addrHtml = addrLine
    ? `<div style="font-size:11px;color:#475569;margin-top:6px;padding-top:6px;border-top:1px solid rgba(0,0,0,.06);">
        ${addrLine}
        ${isApprox ? `<span style="font-size:10px;color:#d97706;margin-left:4px;">(aprox.)</span>` : ""}
      </div>`
    : ""

  return `
    <div style="min-width:180px;max-width:240px;font-family:inherit;">
      <div style="font-weight:600;font-size:13px;margin-bottom:2px;color:#0f172a;">${item.name}</div>
      <div style="font-family:monospace;font-size:11px;color:#64748b;margin-bottom:6px;">${item.code}</div>
      ${badgeHtml}
      ${extraHtml}
      ${addrHtml}
    </div>`
}

// Inject tooltip CSS once
let styleInjected = false
function ensureTooltipStyle() {
  if (styleInjected) return
  styleInjected = true
  const style = document.createElement("style")
  style.textContent = `
    .nexus-map-tooltip {
      background: #ffffff !important;
      border: 1px solid rgba(0,0,0,.08) !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 24px rgba(0,0,0,.12) !important;
      padding: 12px 14px !important;
      color: #0f172a !important;
    }
    .nexus-map-tooltip::before,
    .leaflet-tooltip-top.nexus-map-tooltip::before { display: none !important; }
  `
  document.head.appendChild(style)
}

export type LegendItem = {
  label: string
  color: string
  shape?: "circle" | "pin"
}

export function MapLegend({ items }: { items: LegendItem[] }) {
  return (
    <div className="rounded-lg border border-border bg-card/90 px-3 py-2 shadow-soft-sm backdrop-blur-sm">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Leyenda
      </p>
      <div className="flex flex-col gap-1.5">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2">
            {it.shape === "pin" ? (
              <svg width="12" height="16" viewBox="0 0 26 34" fill="none">
                <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 21 13 21s13-11.25 13-21C26 5.82 20.18 0 13 0z" fill={it.color} />
                <circle cx="13" cy="13" r="5" fill="white" fillOpacity="0.9" />
              </svg>
            ) : (
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: it.color }}
              />
            )}
            <span className="text-[11px] text-foreground">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

type EntityMapProps = {
  items: MapMarkerItem[]
  colorFor: (item: MapMarkerItem) => string
  onSelect?: (id: number) => void
  selectedId?: number | null
  className?: string
}

export function EntityMap({
  items,
  colorFor,
  onSelect,
  selectedId,
  className,
}: EntityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef(new Map<number, L.Marker>())

  const [coordsMap, setCoordsMap] = useState<Map<number, [number, number]>>(new Map())
  const [geocoding, setGeocoding] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const cancelRef = useRef(false)

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    ensureTooltipStyle()

    const map = L.map(containerRef.current, {
      center: [23.6345, -102.5528],
      zoom: 5,
      zoomControl: true,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Geocode items when they change
  useEffect(() => {
    if (items.length === 0) return
    cancelRef.current = false

    // Resolve already-cached results immediately
    const resolved = new Map<number, [number, number]>()
    const pending: MapMarkerItem[] = []

    for (const item of items) {
      if (!item.address) continue
      const queries = buildQueries(item.address)
      let found: [number, number] | null = null
      for (const q of queries) {
        const cached = geocodeCache.get(q)
        if (cached) { found = cached; break }
      }
      if (found) resolved.set(item.id, found)
      else if (queries.length > 0) pending.push(item)
    }

    setCoordsMap(new Map(resolved))

    if (pending.length === 0) return

    setGeocoding(true)
    setProgress({ done: 0, total: pending.length })

    ;(async () => {
      let done = 0
      for (const item of pending) {
        if (cancelRef.current) break
        const coords = await geocodeOne(item.address!)
        if (coords) resolved.set(item.id, coords)
        done++
        if (!cancelRef.current) {
          setProgress({ done, total: pending.length })
          setCoordsMap(new Map(resolved))
        }
      }
      if (!cancelRef.current) setGeocoding(false)
    })()

    return () => { cancelRef.current = true }
  }, [items])

  // Sync markers whenever coords or items change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current.clear()

    const bounds: L.LatLngExpression[] = []

    items.forEach((item) => {
      const coords = coordsMap.get(item.id)
      if (!coords) return

      bounds.push(coords)
      const color = colorFor(item)
      const isApprox = item.address?.is_approximate ?? false
      const marker = L.marker(coords, { icon: makeIcon(color, item.isActive, isApprox) })

      marker.bindTooltip(tooltipHtml(item), {
        permanent: false,
        direction: "top",
        className: "nexus-map-tooltip",
        offset: [0, -4],
      })

      if (onSelect) {
        marker.on("click", () => onSelect(item.id))
      }

      marker.addTo(map)
      markersRef.current.set(item.id, marker)
    })

    if (bounds.length === 1) {
      map.setView(bounds[0] as L.LatLngExpression, 12)
    } else if (bounds.length > 1) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [48, 48], maxZoom: 14 })
    }
  }, [coordsMap, items, colorFor, onSelect])

  // Highlight selected marker
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement()
      if (!el) return
      el.style.zIndex = id === selectedId ? "9999" : ""
      el.style.filter = id === selectedId ? "brightness(1.4)" : ""
    })
  }, [selectedId])

  const withAddress = items.filter((i) => i.address && buildQueries(i.address).length > 0)
  const withoutAddress = items.length - withAddress.length

  return (
    <div className={`relative h-full w-full overflow-hidden ${className ?? ""}`}>
      <div ref={containerRef} className="h-full w-full" />

      {/* Progress overlay */}
      {geocoding && (
        <div className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded-xl border border-border bg-card/95 px-5 py-2.5 text-xs shadow-soft-lg backdrop-blur-md">
          <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
            </span>
            Geocodificando…
            <span className="font-semibold text-primary">
              {progress.done}/{progress.total}
            </span>
          </span>
        </div>
      )}

      {/* Stats chip */}
      {!geocoding && coordsMap.size > 0 && (
        <div className="absolute bottom-5 left-4 z-[1000] flex flex-col gap-1.5">
          <div className="rounded-lg border border-border bg-card/90 px-3 py-1.5 text-[11px] shadow-soft-sm backdrop-blur-sm">
            <span className="font-semibold text-foreground">{coordsMap.size}</span>
            <span className="text-muted-foreground"> ubicaciones</span>
            {withoutAddress > 0 && (
              <span className="ml-1.5 text-muted-foreground">· {withoutAddress} sin datos</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-3 py-1.5 text-[11px] shadow-soft-sm backdrop-blur-sm">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <circle cx="5" cy="5" r="4" fill="none" stroke="#d97706" strokeWidth="1" strokeDasharray="2 1" />
            </svg>
            <span className="text-amber-600">Pin punteado = ubicación aproximada (CP fiscal)</span>
          </div>
        </div>
      )}

      {/* No geocodable addresses */}
      {!geocoding && coordsMap.size === 0 && withAddress.length === 0 && items.length > 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-border bg-card/90 px-6 py-4 text-center text-sm shadow-soft-md backdrop-blur-sm">
            <p className="font-medium text-foreground">Sin ubicaciones disponibles</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Registra direcciones o datos fiscales con CP para ver pines en el mapa
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type DatePreset = "custom" | "hoy" | "7d" | "30d" | "mtd" | "ytd"

type FiltersState = {
  datePreset: DatePreset
  startDate: string | null
  endDate: string | null
}

type FiltersActions = {
  setDatePreset: (preset: DatePreset) => void
  setDateRange: (range: { startDate: string | null; endDate: string | null }) => void
  reset: () => void
}

function toIsoDate(value: Date) {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, "0")
  const d = String(value.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function computePresetRange(preset: DatePreset): {
  startDate: string | null
  endDate: string | null
} {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (preset === "custom") return { startDate: null, endDate: null }
  if (preset === "hoy") return { startDate: toIsoDate(today), endDate: toIsoDate(today) }
  if (preset === "7d") {
    const start = new Date(today)
    start.setDate(start.getDate() - 6)
    return { startDate: toIsoDate(start), endDate: toIsoDate(today) }
  }
  if (preset === "30d") {
    const start = new Date(today)
    start.setDate(start.getDate() - 29)
    return { startDate: toIsoDate(start), endDate: toIsoDate(today) }
  }
  if (preset === "mtd") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    return { startDate: toIsoDate(start), endDate: toIsoDate(today) }
  }
  const start = new Date(today.getFullYear(), 0, 1)
  return { startDate: toIsoDate(start), endDate: toIsoDate(today) }
}

const defaultPreset: DatePreset = "30d"
const defaultRange = computePresetRange(defaultPreset)

const useFiltersStore = create<FiltersState & FiltersActions>()(
  persist(
    (set) => ({
      datePreset: defaultPreset,
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,

      setDatePreset: (preset) => {
        const range = computePresetRange(preset)
        set({ datePreset: preset, startDate: range.startDate, endDate: range.endDate })
      },

      setDateRange: (range) => {
        set({ datePreset: "custom", startDate: range.startDate, endDate: range.endDate })
      },

      reset: () =>
        set({
          datePreset: defaultPreset,
          startDate: defaultRange.startDate,
          endDate: defaultRange.endDate,
        }),
    }),
    {
      name: "nexus-ops-filters",
      partialize: (state) => ({
        datePreset: state.datePreset,
        startDate: state.startDate,
        endDate: state.endDate,
      }),
    }
  )
)

export function useFilters() {
  const datePreset = useFiltersStore((s) => s.datePreset)
  const startDate = useFiltersStore((s) => s.startDate)
  const endDate = useFiltersStore((s) => s.endDate)
  const setDatePreset = useFiltersStore((s) => s.setDatePreset)
  const setDateRange = useFiltersStore((s) => s.setDateRange)
  const reset = useFiltersStore((s) => s.reset)

  return { datePreset, startDate, endDate, setDatePreset, setDateRange, reset }
}

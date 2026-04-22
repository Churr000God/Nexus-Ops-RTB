import { create } from "zustand"

interface SyncStore {
  syncVersion: number
  bumpSyncVersion: () => void
}

export const useSyncStore = create<SyncStore>((set) => ({
  syncVersion: 0,
  bumpSyncVersion: () => set((s) => ({ syncVersion: s.syncVersion + 1 })),
}))

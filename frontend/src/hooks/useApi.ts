import { useCallback, useEffect, useRef, useState } from "react"

import { cacheGet, cacheSet } from "@/lib/queryCache"
import type { ApiError } from "@/lib/http"

export type ApiStatus = "idle" | "loading" | "success" | "error"

export type UseApiResult<T> = {
  data: T | null
  status: ApiStatus
  error: ApiError | Error | null
  refetch: () => void
}

type UseApiOptions = {
  enabled?: boolean
  keepPreviousData?: boolean
  cacheKey?: string
  staleTime?: number
  cacheTtl?: number
}

export function useApi<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options?: UseApiOptions,
  ...deps: unknown[]
): UseApiResult<T> {
  const enabled = options?.enabled ?? true
  const keepPreviousData = options?.keepPreviousData ?? true
  const cacheKey = options?.cacheKey
  const staleTime = options?.staleTime ?? 0
  const cacheTtl = options?.cacheTtl
  const depsKey = JSON.stringify(deps)

  const [data, setData] = useState<T | null>(null)
  const [status, setStatus] = useState<ApiStatus>(enabled ? "loading" : "idle")
  const [error, setError] = useState<ApiError | Error | null>(null)

  const requestId = useRef(0)
  const [refreshIndex, setRefreshIndex] = useState(0)
  // tracks whether the pending effect was triggered by an explicit refetch()
  // call so we can bypass the cache even when staleTime has not elapsed
  const isManualRefetch = useRef(false)

  const refetch = useCallback(() => {
    isManualRefetch.current = true
    setRefreshIndex((v) => v + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => {
        setStatus("idle")
        setError(null)
        if (!keepPreviousData) setData(null)
      })
      return
    }

    const bypassCache = isManualRefetch.current
    isManualRefetch.current = false

    if (!bypassCache && cacheKey && staleTime > 0) {
      const cached = cacheGet<T>(cacheKey, staleTime)
      if (cached !== null) {
        queueMicrotask(() => {
          setData(cached)
          setStatus("success")
          setError(null)
        })
        return
      }
    }

    const controller = new AbortController()
    const currentId = ++requestId.current

    queueMicrotask(() => {
      setStatus("loading")
      setError(null)
      if (!keepPreviousData) setData(null)
    })

    fetcher(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        if (currentId !== requestId.current) return
        if (cacheKey) {
          cacheSet(cacheKey, result, cacheTtl !== undefined ? { ttl: cacheTtl } : undefined)
        }
        setData(result)
        setStatus("success")
      })
      .catch((err: ApiError | Error) => {
        if (controller.signal.aborted) return
        if (currentId !== requestId.current) return
        setError(err)
        setStatus("error")
      })

    return () => controller.abort()
  }, [fetcher, enabled, keepPreviousData, cacheKey, staleTime, cacheTtl, refreshIndex, depsKey])

  return { data, status, error, refetch }
}

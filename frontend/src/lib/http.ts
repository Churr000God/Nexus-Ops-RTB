import { env } from "@/lib/env"

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.details = details
  }
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export async function requestJson<T>(
  path: string,
  opts?: {
    method?: string
    body?: JsonValue
    token?: string | null
    headers?: Record<string, string>
    signal?: AbortSignal
  }
): Promise<T> {
  const url = `${env.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts?.headers ?? {}),
  }

  if (opts?.token) {
    headers.Authorization = `Bearer ${opts.token}`
  }

  const res = await fetch(url, {
    method: opts?.method ?? "GET",
    headers,
    credentials: "include",
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
    signal: opts?.signal,
  })

  const contentType = res.headers.get("content-type") ?? ""
  const isJson = contentType.includes("application/json")

  if (!res.ok) {
    const details = isJson ? await safeJson(res) : await safeText(res)
    const message = typeof details === "string" ? details : "Error de API"
    throw new ApiError(message, res.status, details)
  }

  if (res.status === 204) {
    return undefined as T
  }

  if (!isJson) {
    const text = await res.text()
    return text as T
  }

  return (await res.json()) as T
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ""
  }
}

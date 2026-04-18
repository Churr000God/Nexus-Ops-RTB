function normalizeBaseUrl(raw: string) {
  return raw.replace(/\/+$/, "")
}

export const env = {
  apiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_API_URL ?? "http://localhost:8000"),
}

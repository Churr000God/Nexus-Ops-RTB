import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrencyMXN(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(value)
}

export function formatIsoDate(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date)
}

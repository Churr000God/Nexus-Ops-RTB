import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type DataTableColumn<T> = {
  key: string
  header: string
  className?: string
  cell: (row: T) => ReactNode
}

type DataTableProps<T> = {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyLabel?: string
  onRowClick?: (row: T) => void
  className?: string
  toolbar?: ReactNode
  maxHeight?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyLabel = "Sin resultados",
  onRowClick,
  className,
  toolbar,
  maxHeight,
}: DataTableProps<T>) {
  return (
    <div className={cn("surface-card overflow-hidden border-white/70", className)}>
      {toolbar ? (
        <div className="flex flex-col gap-3 border-b bg-background/80 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          {toolbar}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <div style={maxHeight ? { maxHeight } : undefined} className={cn(maxHeight ? "overflow-y-auto" : "")}>
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[hsl(var(--background))]/95 backdrop-blur">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap border-b px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground md:px-6",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-5 py-12 text-center text-sm text-muted-foreground md:px-6"
                  >
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const key = rowKey(row)
                  return (
                    <tr
                      key={key}
                      className={cn(
                        "border-t border-border/80 transition-colors",
                        onRowClick ? "cursor-pointer hover:bg-accent/55" : "hover:bg-accent/35"
                      )}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn("whitespace-nowrap px-5 py-4 text-[13px] md:px-6", col.className)}
                        >
                          {col.cell(row)}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

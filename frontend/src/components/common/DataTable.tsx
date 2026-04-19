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
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyLabel = "Sin resultados",
  onRowClick,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn("overflow-hidden rounded-lg border", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/40">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-muted-foreground",
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
                  className="px-4 py-10 text-center text-muted-foreground"
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
                      "border-t transition-colors",
                      onRowClick ? "cursor-pointer hover:bg-accent/40" : "hover:bg-accent/20"
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn("whitespace-nowrap px-4 py-3", col.className)}
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
  )
}

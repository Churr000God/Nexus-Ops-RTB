import { LogOut, Menu, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"

type HeaderProps = {
  onOpenSidebar: () => void
  title?: string
  subtitle?: string
  userLabel?: string
  onLogout: () => void
}

export function Header({ onOpenSidebar, title, subtitle, userLabel, onLogout }: HeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-20 border-b border-border/80 bg-card/95 backdrop-blur md:left-[220px]">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSidebar}
          className="rounded-[var(--radius-md)] md:hidden"
          aria-label="Abrir navegación"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold tracking-tight text-foreground">
            {title ?? "Panel"}
          </div>
          {subtitle ? (
            <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
        {userLabel ? (
          <div className="hidden items-center gap-2 rounded-full border bg-background px-3 py-2 text-xs text-muted-foreground shadow-soft-sm sm:flex">
            <ShieldCheck className="h-4 w-4 text-[hsl(var(--primary))]" aria-hidden="true" />
            <span className="truncate">{userLabel}</span>
          </div>
        ) : null}
        <Button variant="outline" size="sm" onClick={onLogout} aria-label="Cerrar sesión">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Salir</span>
        </Button>
      </div>
    </header>
  )
}

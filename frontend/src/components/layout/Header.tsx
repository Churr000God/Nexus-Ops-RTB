import { Menu, ShieldCheck } from "lucide-react"

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
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSidebar}
          className="md:hidden"
          aria-label="Abrir navegación"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{title ?? "Panel"}</div>
          {subtitle ? (
            <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
        {userLabel ? (
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span className="truncate">{userLabel}</span>
          </div>
        ) : null}
        <Button variant="outline" size="sm" onClick={onLogout} aria-label="Cerrar sesión">
          Salir
        </Button>
      </div>
    </header>
  )
}

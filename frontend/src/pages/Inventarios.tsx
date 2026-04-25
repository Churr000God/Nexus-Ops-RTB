import { AlmacenDashboard } from "@/components/dashboards/AlmacenDashboard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"

export function AlmacenPage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Sin sesión</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Inicia sesión para ver el dashboard de Almacén.
        </CardContent>
      </Card>
    )
  }

  return <AlmacenDashboard />
}

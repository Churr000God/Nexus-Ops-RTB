import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"

export function HomePage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sin datos</CardTitle>
          <CardDescription>No hay información de usuario disponible.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            to="/login"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Ir al login
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Bienvenido</CardTitle>
          <CardDescription>Sesión activa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Usuario:</span>{" "}
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Rol:</span>{" "}
            <Badge variant="secondary" className="capitalize">
              {user.role}
            </Badge>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Próximo paso</CardTitle>
          <CardDescription>Sprint 2: dashboards y gráficas</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Las secciones Ventas/Inventarios/Proveedores/Gastos quedan preparadas en navegación y
          estructura.
        </CardContent>
      </Card>
    </div>
  )
}

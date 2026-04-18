import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function NotFoundPage() {
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>404</CardTitle>
        <CardDescription>No se encontró la página solicitada.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link to="/">Volver al inicio</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

import { useEffect } from "react"
import { BrowserRouter } from "react-router-dom"
import { Toaster } from "sonner"

import { useAuth } from "@/hooks/useAuth"
import { AppRoutes } from "@/routes"

export default function App() {
  const { bootstrap } = useAuth()

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  return (
    <BrowserRouter>
      <AppRoutes />
      <Toaster richColors closeButton />
    </BrowserRouter>
  )
}

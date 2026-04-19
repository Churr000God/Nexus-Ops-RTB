import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { fileURLToPath } from "node:url"

const srcDir = fileURLToPath(new URL("./src", import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
})

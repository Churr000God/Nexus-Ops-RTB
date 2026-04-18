export default function App() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1 style={{ margin: 0 }}>Nexus Ops RTB</h1>
      <p style={{ marginTop: 12 }}>
        Frontend inicial listo. API base: {import.meta.env.VITE_API_URL}
      </p>
    </main>
  )
}


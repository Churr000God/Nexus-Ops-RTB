<#
.SYNOPSIS
    Inicializa el entorno de desarrollo completo de Nexus Ops RTB.

.DESCRIPTION
    Pasos que ejecuta:
      1. Verifica que exista .env (copia .env.example si no)
      2. Arranca el relay TCP Supabase en una nueva ventana (si el puerto 5433 no está activo)
      3. Levanta redis + backend con docker compose up --build
      4. Espera a que el backend esté listo (health-check)
      5. Aplica migraciones Alembic (upgrade head)
      6. (Opcional) Levanta el frontend

.PARAMETER SkipRelay
    Omite el inicio del relay. Útil si ya está corriendo en otra terminal.

.PARAMETER SkipMigrations
    Omite las migraciones Alembic.

.PARAMETER SkipN8n
    No levanta postgres-n8n ni n8n (modo ligero — solo backend + redis + frontend + proxy).

.PARAMETER WithNgrok
    También levanta el contenedor ngrok (requiere NGROK_AUTHTOKEN en .env).

.PARAMETER RelayPort
    Puerto local donde escucha el relay (default: 5433).

.EXAMPLE
    .\scripts\init-dev.ps1
    .\scripts\init-dev.ps1 -SkipRelay
    .\scripts\init-dev.ps1 -WithNgrok
    .\scripts\init-dev.ps1 -SkipN8n
    .\scripts\init-dev.ps1 -SkipRelay -SkipMigrations
#>
[CmdletBinding()]
param(
    [switch]$SkipRelay,
    [switch]$SkipMigrations,
    [switch]$SkipN8n,
    [switch]$WithNgrok,
    [switch]$WithFrontend,  # legacy — frontend se levanta por defecto; este flag ya no tiene efecto
    [int]$RelayPort = 5433
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Helpers ─────────────────────────────────────────────────────────────────
function Write-Step {
    param([int]$N, [int]$Total, [string]$Msg)
    Write-Host ""
    Write-Host "[$N/$Total] $Msg" -ForegroundColor Cyan
}
function Write-Ok   { param([string]$Msg) Write-Host "[ OK ] $Msg" -ForegroundColor Green }
function Write-Warn { param([string]$Msg) Write-Host "[WARN] $Msg" -ForegroundColor Yellow }
function Write-Fail { param([string]$Msg) Write-Host "[ERR ] $Msg" -ForegroundColor Red; exit 1 }
function Write-Info { param([string]$Msg) Write-Host "[INFO] $Msg" -ForegroundColor White }

function Test-PortOpen {
    param([int]$Port, [string]$Address = "127.0.0.1")
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect($Address, $Port)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

function Wait-Port {
    param([int]$Port, [int]$TimeoutSecs = 30, [string]$Label = "puerto $Port")
    $elapsed = 0
    Write-Info "Esperando $Label (max ${TimeoutSecs}s)..."
    while ($elapsed -lt $TimeoutSecs) {
        if (Test-PortOpen -Port $Port) {
            Write-Ok "$Label disponible."
            return
        }
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
    Write-Fail "Timeout esperando $Label después de ${TimeoutSecs}s."
}

# ── Directorio raíz ──────────────────────────────────────────────────────────
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$TotalSteps = if ($SkipMigrations) { 3 } else { 4 }
if ($WithNgrok) { $TotalSteps++ }

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║     Nexus Ops RTB — Inicialización de entorno DEV    ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Magenta

# ── Paso 1: .env ─────────────────────────────────────────────────────────────
$Step = 1
Write-Step $Step $TotalSteps "Verificando archivo .env"

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Warn ".env no existía — se copió desde .env.example."
        Write-Warn "Revisa las variables antes de continuar (especialmente DATABASE_URL_DOCKER)."
    } else {
        Write-Fail "No existe .env ni .env.example. Crea el archivo .env antes de continuar."
    }
} else {
    Write-Ok ".env encontrado."
}

# ── Paso 2: Relay Supabase TCP ────────────────────────────────────────────────
$Step++
Write-Step $Step $TotalSteps "Relay TCP Supabase (puerto $RelayPort)"

if ($SkipRelay) {
    Write-Warn "SkipRelay activo — asumiendo que el relay ya corre en el puerto $RelayPort."
} elseif (Test-PortOpen -Port $RelayPort) {
    Write-Ok "Puerto $RelayPort ya está activo — relay corriendo."
} else {
    Write-Info "Iniciando relay en una nueva ventana de PowerShell..."
    $RelayScript = Join-Path $Root "scripts\supabase-relay.py"
    Start-Process pwsh -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$Root'; Write-Host '[Relay] Iniciando...' -ForegroundColor Cyan; python '$RelayScript' --port $RelayPort"
    )
    # Esperar a que el relay levante
    Wait-Port -Port $RelayPort -TimeoutSecs 20 -Label "relay Supabase (puerto $RelayPort)"
}

# ── Paso 3: Docker Compose — todos los servicios core ────────────────────────
$Step++
Write-Step $Step $TotalSteps "Docker Compose — servicios core"

$coreServices = if ($SkipN8n) {
    @("redis", "backend", "frontend", "proxy")
} else {
    @("redis", "backend", "postgres-n8n", "n8n", "frontend", "proxy")
}

Write-Info "Construyendo e iniciando: $($coreServices -join ', ')..."
docker compose up -d --build @coreServices
if ($LASTEXITCODE -ne 0) {
    Write-Fail "docker compose up falló (exit $LASTEXITCODE)."
}

# Esperar a que el backend responda en el puerto 8000
Write-Info "Esperando que el backend esté listo en puerto 8000..."
$backendUp = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:8000/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) {
            $backendUp = $true
            break
        }
    } catch { }
    Start-Sleep -Seconds 2
}

if ($backendUp) {
    Write-Ok "Backend listo en http://localhost:8000"
} else {
    # No falla — el backend puede estar arriba sin /health implementado
    Write-Warn "No se pudo confirmar /health del backend. Continuando de todas formas."
    Write-Info "Logs recientes:"
    docker compose logs --tail=10 backend
}

# ── Paso 4: Migraciones Alembic ───────────────────────────────────────────────
if (-not $SkipMigrations) {
    $Step++
    Write-Step $Step $TotalSteps "Alembic — upgrade head"

    Write-Info "Aplicando migraciones pendientes..."
    docker compose exec backend alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "alembic upgrade head falló (exit $LASTEXITCODE)."
    }
    Write-Ok "Migraciones aplicadas."
}

# ── Paso opcional: Ngrok ─────────────────────────────────────────────────────
if ($WithNgrok) {
    $Step++
    Write-Step $Step $TotalSteps "Docker Compose — Ngrok"
    docker compose up -d ngrok
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Ngrok falló al levantarse (exit $LASTEXITCODE). Verifica NGROK_AUTHTOKEN en .env."
    } else {
        Write-Ok "Ngrok levantado — dashboard en http://localhost:4040"
    }
}

# ── Resumen ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║            Inicialización completada                 ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend     →  http://localhost:5173"      -ForegroundColor White
Write-Host "  API Backend  →  http://localhost:8000"       -ForegroundColor White
Write-Host "  Swagger Docs →  http://localhost:8000/docs"  -ForegroundColor White
Write-Host "  Proxy Nginx  →  http://localhost:80"         -ForegroundColor White
if (-not $SkipN8n) {
    Write-Host "  n8n          →  http://localhost:5678"   -ForegroundColor White
}
if ($WithNgrok) {
    Write-Host "  Ngrok UI     →  http://localhost:4040"   -ForegroundColor White
}
Write-Host ""
Write-Host "  Relay Supabase corriendo en puerto $RelayPort" -ForegroundColor DarkGray
Write-Host "  (mantén la ventana del relay abierta mientras desarrollas)" -ForegroundColor DarkGray
Write-Host ""

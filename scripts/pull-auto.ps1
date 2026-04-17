Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [string]$Branch = "main",
  [switch]$NoStash
)

$isRepo = (& git rev-parse --is-inside-work-tree 2>$null)
if ($LASTEXITCODE -ne 0 -or $isRepo -ne "true") {
  Write-Error "No estás dentro de un repositorio Git."
  exit 1
}

$stashed = $false
if (-not $NoStash) {
  $status = (& git status --porcelain)
  if (-not [string]::IsNullOrWhiteSpace($status)) {
    & git stash push -u -m ("auto-stash-" + [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss")) | Out-Null
    $stashed = $true
  }
}

& git fetch origin
& git checkout $Branch
& git pull --ff-only origin $Branch

if ($stashed) {
  try {
    & git stash pop | Out-Null
  } catch {
    Write-Error "Se aplicó el pull, pero hubo conflicto al re-aplicar el stash. El stash se mantiene para resolución manual."
    exit 2
  }
}

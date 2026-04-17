Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [string]$BaseBranch = "main",
  [string]$Message = "",
  [string]$Prefix = "auto"
)

$isRepo = (& git rev-parse --is-inside-work-tree 2>$null)
if ($LASTEXITCODE -ne 0 -or $isRepo -ne "true") {
  Write-Error "No estás dentro de un repositorio Git."
  exit 1
}

if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = "chore: auto update $([DateTime]::UtcNow.ToString('s'))Z"
}

$user = ($env:USERNAME ?? "user") -replace "[^a-zA-Z0-9._-]", ""
$stamp = [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss")
$branch = "$Prefix/$user/$stamp"

& git fetch origin

$status = (& git status --porcelain)
if ([string]::IsNullOrWhiteSpace($status)) {
  & git checkout $BaseBranch
  & git pull --ff-only origin $BaseBranch
}

& git checkout -b $branch
& git add -A
& git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "No hay cambios para commitear."
  exit 0
}

& git commit -m $Message
& git push -u origin $branch

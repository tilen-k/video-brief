# Cursor worktree bootstrap for VideoBrief.
# Runs inside the new worktree. $env:ROOT_WORKTREE_PATH is the primary checkout.
$ErrorActionPreference = "Stop"

$env:Path = "$env:LOCALAPPDATA\pnpm;$env:USERPROFILE\.local\bin;$env:Path"
$env:CI = "true"

$root = $env:ROOT_WORKTREE_PATH

function Copy-FromRoot([string]$name) {
  if ($root -and (Test-Path (Join-Path $root $name)) -and -not (Test-Path $name)) {
    Copy-Item (Join-Path $root $name) $name
  }
}

Copy-FromRoot ".env.local"
Copy-FromRoot ".env"

if (-not (Test-Path ".env.local") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env.local"
}

if (-not $root) {
  throw "ROOT_WORKTREE_PATH must point at the primary checkout."
}

$modulesReady = (Test-Path "node_modules\.pnpm") -and (Test-Path "node_modules\next") -and (Test-Path "node_modules\.modules.yaml")
if ($modulesReady) {
  Write-Host "node_modules already present."
  exit 0
}

pnpm install --frozen-lockfile --trust-lockfile --prefer-offline --config.fetch-retries=0 --config.fetch-timeout=10000
if ($LASTEXITCODE -ne 0) {
  Write-Error "pnpm install failed. Run 'pnpm install' in the primary checkout, then re-run setup."
  exit 1
}

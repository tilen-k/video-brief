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

function Test-ModulesReady([string]$base = ".") {
  return (Test-Path (Join-Path $base "node_modules\.pnpm")) `
    -and (Test-Path (Join-Path $base "node_modules\next")) `
    -and (Test-Path (Join-Path $base "node_modules\.modules.yaml"))
}

Copy-FromRoot ".env.local"
Copy-FromRoot ".env"

if (-not (Test-Path ".env.local") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env.local"
}

if (-not $root) {
  throw "ROOT_WORKTREE_PATH must point at the primary checkout."
}

if (Test-ModulesReady ".") {
  Write-Host "node_modules already present."
  exit 0
}

if (Test-Path "node_modules") {
  Write-Host "Removing incomplete node_modules before setup..."
  Remove-Item -Recurse -Force "node_modules"
}

# Fast path: copy primary node_modules (avoids sandbox/store hangs).
if (Test-ModulesReady $root) {
  Write-Host "Copying node_modules from primary checkout..."
  Copy-Item -Recurse -Force (Join-Path $root "node_modules") "node_modules"
  Write-Host "node_modules ready (copied from primary)."
  exit 0
}

$storeDir = Join-Path $env:LOCALAPPDATA "pnpm\store\v11"
$modulesYaml = Join-Path $root "node_modules\.modules.yaml"
if (Test-Path $modulesYaml) {
  $match = Select-String -Path $modulesYaml -Pattern '"storeDir":\s*"([^"]+)"' | Select-Object -First 1
  if ($match) {
    $storeDir = $match.Matches[0].Groups[1].Value
  }
}

Write-Host "Running offline pnpm install from store: $storeDir"
pnpm install --frozen-lockfile --trust-lockfile --offline --frozen-store --store-dir $storeDir --config.fetch-retries=0 --config.fetch-timeout=5000
if ($LASTEXITCODE -ne 0) {
  Write-Error "pnpm install failed. Run 'pnpm install' in the primary checkout, then re-run setup."
  exit 1
}

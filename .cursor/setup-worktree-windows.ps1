# Cursor worktree bootstrap for VideoBrief.
# Runs inside the new worktree. $env:ROOT_WORKTREE_PATH is the primary checkout.
$ErrorActionPreference = "Stop"

$env:Path = "$env:LOCALAPPDATA\pnpm;$env:USERPROFILE\.local\bin;$env:Path"

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

pnpm install

#!/usr/bin/env bash
set -euo pipefail

# Discard hook stdin; stdout must be JSON only.
cat >/dev/null

mkdir -p "${CURSOR_PROJECT_DIR:-.}/.cursor/hooks/state"
touch "${CURSOR_PROJECT_DIR:-.}/.cursor/hooks/state/needs-verify"
echo '{}'

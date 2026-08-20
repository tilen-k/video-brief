#!/usr/bin/env bash
set -euo pipefail

ROOT="${CURSOR_PROJECT_DIR:-.}"
STATE="$ROOT/.cursor/hooks/state/needs-verify"
INPUT="$(cat)"

# Cursor hook PATH is often minimal; ensure pnpm is findable.
export PATH="${HOME}/.local/share/pnpm/bin:${HOME}/.local/bin:${PATH}"

# Logs go to stderr — stdout is JSON only for Cursor hooks.
python3 - "$INPUT" "$STATE" "$ROOT" <<'PY'
import json
import os
import shutil
import subprocess
import sys

payload = json.loads(sys.argv[1])
state_path = sys.argv[2]
root = sys.argv[3]

status = payload.get("status", "")
loop_count = int(payload.get("loop_count") or 0)


def emit(obj: object) -> None:
    sys.stdout.write(json.dumps(obj) + "\n")


try:
    # Skip when the user aborted, the turn errored, or no Agent file edits happened.
    if status != "completed" or not os.path.exists(state_path):
        emit({})
        sys.exit(0)

    # Cap auto-retries; loop_limit in hooks.json is defense-in-depth.
    if loop_count >= 3:
        emit({})
        sys.exit(0)

    pnpm = shutil.which("pnpm")
    if not pnpm:
        os.remove(state_path)
        emit(
            {
                "followup_message": (
                    "Mechanical done-check could not find `pnpm` on PATH. "
                    "Install pnpm or fix PATH, then re-run type-check / lint / test."
                )
            }
        )
        sys.exit(0)

    cmds = [
        [pnpm, "type-check"],
        [pnpm, "lint"],
        [pnpm, "test"],
    ]
    failed: list[str] = []
    for cmd in cmds:
        proc = subprocess.run(cmd, cwd=root, capture_output=True, text=True)
        if proc.returncode != 0:
            out = (proc.stdout or "") + (proc.stderr or "")
            failed.append(f"$ {' '.join(cmd)}\nexit {proc.returncode}\n{out[-4000:]}")

    os.remove(state_path)

    if not failed:
        emit({})
        sys.exit(0)

    msg = (
        "Mechanical done-check failed. Fix these, then stop.\n\n"
        + "\n\n".join(failed)
    )
    emit({"followup_message": msg})
except Exception as exc:  # noqa: BLE001 — never break agent stop on hook bugs
    print(f"[verify-done] hook error: {exc}", file=sys.stderr)
    emit({})
PY

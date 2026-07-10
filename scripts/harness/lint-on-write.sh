#!/usr/bin/env bash
# PostToolUse hook: lint a markdown file after a Write/Edit tool call.
# Reads the hook JSON payload on stdin, runs the bundled lappe-linter CLI in
# fix mode, and appends its JSON output lines to the session-data spool.
#
# FAIL OPEN: this script never blocks the agent write. Every error path exits
# 0; failures are logged to stderr only. Portable across macOS BSD userland
# (bash 3.2) and Ubuntu: no GNU-only flags, no jq, no readlink -f.
#
# Environment:
#   LINT_SPOOL        spool file path (default ~/.claude/telemetry/lint-spool.jsonl)
#   LAPPE_LINTER_BIN  CLI binary override (default: lappe-linter on PATH)

set -u
trap 'exit 0' EXIT

log() { printf 'lint-on-write: %s\n' "$*" >&2; }
fail_open() { log "$*"; exit 0; }

command -v python3 >/dev/null 2>&1 || exit 0

payload="$(cat 2>/dev/null || true)"
[ -n "$payload" ] || exit 0

parsed="$(printf '%s' "$payload" | python3 -c '
import json
import sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
tool_input = data.get("tool_input") or {}
path = tool_input.get("file_path") or ""
session = data.get("session_id") or ""
if "\n" in path:
    sys.exit(0)
sys.stdout.write(path + "\n" + session + "\n")
' 2>/dev/null || true)"

file_path="$(printf '%s\n' "$parsed" | sed -n 1p)"
session_id="$(printf '%s\n' "$parsed" | sed -n 2p)"

[ -n "$file_path" ] || exit 0
case "$file_path" in
  *.md) ;;
  *) exit 0 ;;
esac
[ -f "$file_path" ] || exit 0

file_path="$(python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$file_path" 2>/dev/null)" || fail_open 'realpath resolution failed'
[ -n "$file_path" ] || exit 0

config=''
dir="$(dirname "$file_path")"
while :; do
  if [ -f "$dir/linter.yaml" ]; then
    config="$dir/linter.yaml"
    break
  fi
  [ "$dir" = '/' ] && break
  dir="$(dirname "$dir")"
done
[ -n "$config" ] || exit 0

linter_bin="${LAPPE_LINTER_BIN:-lappe-linter}"
command -v "$linter_bin" >/dev/null 2>&1 || fail_open "linter CLI not found: $linter_bin"

cli_output="$("$linter_bin" fix --json --config "$config" "$file_path" 2>/dev/null)" || fail_open "linter CLI failed (exit $?) on $file_path"
[ -n "$cli_output" ] || exit 0

spool="${LINT_SPOOL:-$HOME/.claude/telemetry/lint-spool.jsonl}"
spool_dir="$(dirname "$spool")"
mkdir -p "$spool_dir" 2>/dev/null || fail_open "cannot create spool directory: $spool_dir"

printf '%s\n' "$cli_output" | python3 -c '
import json
import sys
import time
session = sys.argv[1]
out = []
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        obj = json.loads(line)
    except Exception:
        continue
    obj.setdefault("session_id", session)
    obj.setdefault("ts", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    out.append(json.dumps(obj, separators=(",", ":")))
if out:
    sys.stdout.write("\n".join(out) + "\n")
' "$session_id" >> "$spool" 2>/dev/null || fail_open "spool append failed: $spool"

exit 0

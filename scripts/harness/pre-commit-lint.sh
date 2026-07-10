#!/usr/bin/env bash
# Pre-commit gate: lappe-linter check --changed.
#
# FAIL CLOSED: any nonzero CLI exit (violations, config error, missing CLI)
# blocks the commit and prints the check output.
#
# Escape hatch for emergency commits:
#   LINTER_SKIP=1 git commit ...
#
# Environment:
#   LAPPE_LINTER_BIN  CLI binary override (default: lappe-linter on PATH)

set -u

if [ "${LINTER_SKIP:-0}" = '1' ]; then
  echo 'pre-commit-lint: LINTER_SKIP=1 set; skipping lint gate for this commit.' >&2
  exit 0
fi

linter_bin="${LAPPE_LINTER_BIN:-lappe-linter}"

if ! command -v "$linter_bin" >/dev/null 2>&1; then
  echo "pre-commit-lint: linter CLI not found: $linter_bin" >&2
  echo 'pre-commit-lint: install the bundled CLI or set LAPPE_LINTER_BIN to its path.' >&2
  echo 'pre-commit-lint: emergency bypass: LINTER_SKIP=1 git commit ...' >&2
  exit 1
fi

"$linter_bin" check --changed
status=$?

if [ "$status" -ne 0 ]; then
  echo '' >&2
  echo "pre-commit-lint: lint check failed (exit $status); commit blocked." >&2
  echo "pre-commit-lint: fix with '$linter_bin fix --changed', or bypass once with LINTER_SKIP=1." >&2
fi

exit "$status"

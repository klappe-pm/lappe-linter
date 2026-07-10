#!/usr/bin/env bash
# Test runner for the F07 harness artifacts. No dependency on the real CLI:
# lappe-linter is faked via a PATH shim. Runs on macOS BSD userland (bash 3.2)
# and Ubuntu. Usage: bash scripts/harness/tests/run.sh

set -u

here="$(cd "$(dirname "$0")" && pwd)"
harness_dir="$(dirname "$here")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

pass=0
fail=0

ok() { pass=$((pass + 1)); echo "ok - $1"; }
not_ok() { fail=$((fail + 1)); echo "not ok - $1"; }

assert_eq() {
  if [ "$1" = "$2" ]; then
    ok "$3"
  else
    not_ok "$3 (expected '$1', got '$2')"
  fi
}

assert_grep() {
  if grep -q "$1" "$2" 2>/dev/null; then
    ok "$3"
  else
    not_ok "$3 (pattern '$1' not found in $2)"
  fi
}

spool_lines() {
  if [ -f "$1" ]; then
    wc -l < "$1" | tr -d ' '
  else
    echo 0
  fi
}

# --- fake lappe-linter CLI via PATH shim ---
mkdir -p "$tmp/bin"
cat > "$tmp/bin/lappe-linter" <<'SHIM'
#!/usr/bin/env bash
mode="${FAKE_LINTER_MODE:-ok}"
case "$mode" in
  ok)
    last=''
    for arg in "$@"; do last="$arg"; done
    printf '{"path":"%s","profile":"default","violations":[{"rule":"trailing-spaces","line":3,"message":"trailing whitespace","fixed":true}],"renamed_to":null,"output-version":1}\n' "$last"
    exit 0
    ;;
  clean)
    exit 0
    ;;
  violations)
    echo 'note.md:3 trailing-spaces trailing whitespace'
    exit 1
    ;;
  crash)
    echo 'fake linter crash' >&2
    exit 2
    ;;
esac
SHIM
chmod +x "$tmp/bin/lappe-linter"
export PATH="$tmp/bin:$PATH"

# --- vault fixture ---
vault="$tmp/vault"
mkdir -p "$vault/notes"
printf 'rules: {}\n' > "$vault/linter.yaml"
printf '# note\n\nbody text\n' > "$vault/notes/note.md"

payload() {
  python3 -c 'import json, sys; print(json.dumps({"session_id": "test-session", "hook_event_name": "PostToolUse", "tool_name": "Write", "tool_input": {"file_path": sys.argv[1]}}))' "$1"
}

# --- lint-on-write: happy path appends an annotated spool line ---
spool="$tmp/spool.jsonl"
export LINT_SPOOL="$spool"

payload "$vault/notes/note.md" | bash "$harness_dir/lint-on-write.sh" 2>/dev/null
st=$?
assert_eq 0 "$st" 'lint-on-write exits 0 on lint success'
assert_eq 1 "$(spool_lines "$spool")" 'lint-on-write appends one spool line'
assert_grep '"rule":"trailing-spaces"' "$spool" 'spool line carries the violation'
assert_grep '"session_id":"test-session"' "$spool" 'spool line annotated with session_id'
assert_grep '"ts":' "$spool" 'spool line annotated with ts'
assert_grep '"output-version":1' "$spool" 'spool line keeps output-version 1'

# --- lint-on-write: non-markdown path is ignored silently ---
printf 'x\n' > "$vault/notes/data.txt"
payload "$vault/notes/data.txt" | bash "$harness_dir/lint-on-write.sh" 2>/dev/null
st=$?
assert_eq 0 "$st" 'lint-on-write exits 0 on non-markdown path'
assert_eq 1 "$(spool_lines "$spool")" 'non-markdown path adds no spool line'

# --- lint-on-write: fail open on missing file ---
payload "$vault/notes/missing.md" | bash "$harness_dir/lint-on-write.sh" 2>/dev/null
st=$?
assert_eq 0 "$st" 'lint-on-write exits 0 on missing file'
assert_eq 1 "$(spool_lines "$spool")" 'missing file adds no spool line'

# --- lint-on-write: fail open on CLI crash ---
payload "$vault/notes/note.md" | FAKE_LINTER_MODE=crash bash "$harness_dir/lint-on-write.sh" 2>"$tmp/crash.err"
st=$?
assert_eq 0 "$st" 'lint-on-write exits 0 when the CLI crashes'
assert_eq 1 "$(spool_lines "$spool")" 'CLI crash adds no spool line'
assert_grep 'linter CLI failed' "$tmp/crash.err" 'CLI crash is logged to stderr'

# --- lint-on-write: fail open on malformed payload ---
printf 'not json at all' | bash "$harness_dir/lint-on-write.sh" 2>/dev/null
st=$?
assert_eq 0 "$st" 'lint-on-write exits 0 on malformed payload'
assert_eq 1 "$(spool_lines "$spool")" 'malformed payload adds no spool line'

# --- lint-on-write: no linter.yaml above the file means silent skip ---
mkdir -p "$tmp/plain"
printf '# stray\n' > "$tmp/plain/stray.md"
payload "$tmp/plain/stray.md" | bash "$harness_dir/lint-on-write.sh" 2>/dev/null
st=$?
assert_eq 0 "$st" 'lint-on-write exits 0 when no linter.yaml governs the file'
assert_eq 1 "$(spool_lines "$spool")" 'unconfigured file adds no spool line'

# --- lint-on-write: clean lint output appends nothing ---
payload "$vault/notes/note.md" | FAKE_LINTER_MODE=clean bash "$harness_dir/lint-on-write.sh" 2>/dev/null
st=$?
assert_eq 0 "$st" 'lint-on-write exits 0 on clean lint output'
assert_eq 1 "$(spool_lines "$spool")" 'clean lint output adds no spool line'

# --- ingest: idempotent on replay ---
db="$tmp/lint.db"
ingest_spool="$tmp/ingest-spool.jsonl"
cat > "$ingest_spool" <<'EOF'
{"path":"/v/a.md","profile":"default","violations":[{"rule":"r1","line":1,"message":"m1","fixed":true},{"rule":"r2","line":2,"message":"m2","fixed":false}],"renamed_to":null,"output-version":1,"session_id":"s1","ts":"2026-07-10T00:00:00Z"}
{"path":"/v/b.md","profile":"default","violations":[],"renamed_to":null,"output-version":1,"session_id":"s1","ts":"2026-07-10T00:00:01Z"}
this line is not json
EOF

python3 "$harness_dir/ingest-lint-spool.py" "$db" "$ingest_spool" >/dev/null 2>&1
st=$?
assert_eq 0 "$st" 'ingest exits 0 despite a malformed line'

count_rows() {
  python3 -c 'import sqlite3, sys; print(sqlite3.connect(sys.argv[1]).execute("select count(*) from lint_events").fetchone()[0])' "$1"
}

count1="$(count_rows "$db")"
assert_eq 2 "$count1" 'ingest inserts one row per violation'

python3 "$harness_dir/ingest-lint-spool.py" "$db" "$ingest_spool" >/dev/null 2>&1
count2="$(count_rows "$db")"
assert_eq "$count1" "$count2" 'ingest replay inserts zero new rows'

distinct_hashes="$(python3 -c 'import sqlite3, sys; print(sqlite3.connect(sys.argv[1]).execute("select count(distinct content_hash) from lint_events").fetchone()[0])' "$db")"
assert_eq "$count1" "$distinct_hashes" 'each row carries a distinct content hash'

fixed_flag="$(python3 -c 'import sqlite3, sys; print(sqlite3.connect(sys.argv[1]).execute("select fixed from lint_events where rule=\"r1\"").fetchone()[0])' "$db")"
assert_eq 1 "$fixed_flag" 'fixed boolean stored as integer 1'

# --- pre-commit: LINTER_SKIP=1 escape hatch ---
LINTER_SKIP=1 bash "$harness_dir/pre-commit-lint.sh" >/dev/null 2>"$tmp/skip.err"
st=$?
assert_eq 0 "$st" 'pre-commit exits 0 under LINTER_SKIP=1'
assert_grep 'LINTER_SKIP=1' "$tmp/skip.err" 'pre-commit prints a skip notice'

# --- pre-commit: clean check passes ---
FAKE_LINTER_MODE=clean bash "$harness_dir/pre-commit-lint.sh" >/dev/null 2>&1
st=$?
assert_eq 0 "$st" 'pre-commit exits 0 on a clean check'

# --- pre-commit: violations block the commit (fail closed) ---
FAKE_LINTER_MODE=violations bash "$harness_dir/pre-commit-lint.sh" >"$tmp/violations.out" 2>"$tmp/violations.err"
st=$?
assert_eq 1 "$st" 'pre-commit exits 1 on violations'
assert_grep 'trailing-spaces' "$tmp/violations.out" 'pre-commit prints the check output'
assert_grep 'commit blocked' "$tmp/violations.err" 'pre-commit explains the block'

# --- pre-commit: missing CLI blocks the commit (fail closed) ---
PATH='/usr/bin:/bin' bash "$harness_dir/pre-commit-lint.sh" >/dev/null 2>"$tmp/missing.err"
st=$?
assert_eq 1 "$st" 'pre-commit exits 1 when the CLI is missing'
assert_grep 'linter CLI not found' "$tmp/missing.err" 'pre-commit reports the missing CLI'

echo ''
echo "passed: $pass, failed: $fail"
[ "$fail" -eq 0 ] || exit 1
exit 0

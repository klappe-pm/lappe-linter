#!/usr/bin/env bash
# Install the built lappe-linter plugin into an Obsidian vault.
#
# Usage: scripts/install-test-vault.sh [--no-build] [vault-path]
#   vault-path defaults to the repo's test-vault. The script copies
#   dist-plugin/lappe-linter/{main.js,manifest.json,styles.css} into
#   <vault>/.obsidian/plugins/lappe-linter/, keeps any existing data.json,
#   and ensures the plugin id is enabled in community-plugins.json.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
build=1
vault=""
for arg in "$@"; do
  case "$arg" in
    --no-build) build=0 ;;
    *) vault="$arg" ;;
  esac
done
vault="${vault:-$repo_root/test-vault}"

if [ ! -d "$vault" ]; then
  echo "error: vault not found: $vault" >&2
  exit 1
fi

if [ "$build" -eq 1 ]; then
  (cd "$repo_root" && npm run build && npm run minify-css)
  mkdir -p "$repo_root/dist-plugin/lappe-linter"
  cp "$repo_root/main.js" "$repo_root/manifest.json" "$repo_root/styles.css" "$repo_root/dist-plugin/lappe-linter/"
fi

dist="$repo_root/dist-plugin/lappe-linter"
for f in main.js manifest.json styles.css; do
  if [ ! -f "$dist/$f" ]; then
    echo "error: missing $dist/$f (run without --no-build first)" >&2
    exit 1
  fi
done

target="$vault/.obsidian/plugins/lappe-linter"
mkdir -p "$target"
cp "$dist/main.js" "$dist/manifest.json" "$dist/styles.css" "$target/"

plugins_json="$vault/.obsidian/community-plugins.json"
python3 - "$plugins_json" <<'PY'
import json
import sys

path = sys.argv[1]
try:
    with open(path) as f:
        plugins = json.load(f)
except FileNotFoundError:
    plugins = []
if not isinstance(plugins, list):
    raise SystemExit(f"error: {path} is not a JSON list")
changed = False
if "obsidian-linter" in plugins:
    plugins.remove("obsidian-linter")
    changed = True
if "lappe-linter" not in plugins:
    plugins.append("lappe-linter")
    changed = True
if changed:
    with open(path, "w") as f:
        json.dump(plugins, f, indent=2)
        f.write("\n")
PY

echo "installed lappe-linter into $target"
echo "restart Obsidian (or trigger hot-reload) to pick up the new build"

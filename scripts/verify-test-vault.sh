#!/usr/bin/env bash
# Build, install, and verify the exact artifact used by a throwaway Obsidian
# acceptance run.
#
# Usage: scripts/verify-test-vault.sh [vault-path]
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
vault="${1:-$repo_root/test-vault}"

"$repo_root/scripts/install-test-vault.sh" "$vault"

artifact="$repo_root/dist-plugin/lappe-linter"
installed="$vault/.obsidian/plugins/lappe-linter"
for file in main.js manifest.json styles.css; do
  if [[ ! -f "$installed/$file" ]]; then
    echo "error: missing installed artifact $installed/$file" >&2
    exit 1
  fi
done

read -r plugin_id plugin_version < <(python3 - "$installed/manifest.json" <<'PY'
import json
import sys

with open(sys.argv[1]) as f:
    manifest = json.load(f)
print(manifest.get('id', ''), manifest.get('version', ''))
PY
)

if [[ "$plugin_id" != "lappe-linter" ]]; then
  echo "error: installed manifest id is '$plugin_id', expected lappe-linter" >&2
  exit 1
fi

sha256="$(shasum -a 256 "$installed/main.js" | awk '{print $1}')"
printf 'vault=%s\n' "$vault"
printf 'plugin_id=%s\n' "$plugin_id"
printf 'plugin_version=%s\n' "$plugin_version"
printf 'artifact=%s\n' "$installed/main.js"
printf 'artifact_sha256=%s\n' "$sha256"
printf 'community_plugin_enabled=' 
python3 - "$vault/.obsidian/community-plugins.json" <<'PY'
import json
import sys

with open(sys.argv[1]) as f:
    plugins = json.load(f)
print('yes' if 'lappe-linter' in plugins else 'no')
PY

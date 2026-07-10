# lappe-linter

lappe-linter is a hard fork of [platers/obsidian-linter](https://github.com/platers/obsidian-linter) that adds scoped, config-file-driven linting with a shared pure rule core consumed by both the Obsidian plugin and a headless CLI. The upstream plugin's rules and settings keep working unchanged; the lappe layer adds a `linter.yaml` control plane, per-scope profiles, note-type frontmatter schemas, filename rules, and token-free linting from hooks and CI.

This README is hand-maintained. Upstream's generated rule documentation lives on the [obsidian-linter wiki](https://platers.github.io/obsidian-linter/).

## Monorepo Layout

- Repo root: the Obsidian plugin, kept in the upstream layout ([dec-004](docs/plans/decisions.md)) so merges from upstream stay path-conflict-free.
- `packages/core`: `@lappe-linter/core`, the pure rule core: rules, scope engine, config loader, note-type schemas, and the provider API. Zero `obsidian` imports, enforced by `packages/core/__tests__/no-obsidian.test.ts`.
- `packages/cli`: `@lappe-linter/cli`, the headless runner (bin `lappe-linter`).
- `scripts/harness`: Claude Code hook and pre-commit artifacts; installation is covered by [docs/harness/install.md](docs/harness/install.md).

Feature specs and decisions live under [docs/plans/](docs/plans/).

## The linter.yaml Control Plane

`linter.yaml` at the vault root is the single git-tracked source of truth for rule configuration, profiles, and note types; `lappe-linter.yaml` is an accepted alias and `linter.yaml` wins when both exist. The loader fails closed: an invalid file disables scoped linting with one notice instead of applying a partial config. When the file is absent, compiled defaults are active ([dec-005](docs/plans/decisions.md)); create it from the Lappe settings tab button or with `lappe-linter init`. The full schema reference is [docs/linter-yaml.md](docs/linter-yaml.md).

## The Lappe Settings Tab

The Lappe tab in the plugin settings is a view over `linter.yaml`: a combined YAML key sort order control, enable toggles for the core rules, the style file list, and a read-only summary of profiles and note types. Every edit writes back to the file through a comment-preserving serializer; hand edits to the file win and reload live.

## Styles Folder

Files in `linter-styles/*.yaml` next to `linter.yaml` merge as named profile fragments: one file is one profile, bound to folders, tags, or properties by its `match` block. `linter.yaml` wins name conflicts. Styles currently apply plugin-side only; the CLI does not read the folder yet.

## CLI

`lappe-linter` runs the same core rules headlessly: `check` (exit 1 on violations), `fix` (including `--stdin` filter mode), `explain` (resolved config and profile chain for a path), `new-rule` (scaffold a custom rule), and `init` (starter `linter.yaml`). Exit codes: 0 clean or fixed, 1 check violations, 2 config or usage error. `--json` emits one JSON line per file (output-version 1); `--changed` targets git-changed markdown files for pre-commit gates.

## Extending

`lappe-linter new-rule <name>` scaffolds a pure rule, its test, and its registration under `packages/core/src/rules-custom/`. Separate products contribute rules and note-type schemas at runtime through the provider API; see the [provider authoring guide](packages/core/src/providers/authoring-guide.md).

## Upstream Sync Policy

Upstream rules stay at their root paths unchanged, and upstream rule docs remain on the [platers wiki](https://platers.github.io/obsidian-linter/). Merges from `upstream/master` are expected to stay path-conflict-free because all lappe code lives in `packages/`, `src/lappe/`, and a small number of clearly marked integration points.

## Development

- `npm test` runs the full jest suite (upstream plugin tests plus core and CLI tests).
- `npx tsc -p packages/core/tsconfig.json --noEmit` typechecks the core.
- `npm run build` builds the core and bundles the plugin.

## Credits and License

Forked from [platers/obsidian-linter](https://github.com/platers/obsidian-linter) by Victor Tao and contributors; all upstream rule behavior and translations are their work. MIT licensed; see [LICENSE](LICENSE).

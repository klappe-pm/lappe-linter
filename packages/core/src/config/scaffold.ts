/**
 * Starter linter.yaml template. This is the one-file preferences surface:
 * every default carries an inline comment saying what it does and how to
 * change it. The template must always parse clean through parseLinterConfig.
 */
export function scaffoldConfig(): string {
  return `# linter.yaml is the control plane for lappe-linter: the single git-tracked
# source of truth for rule configuration, profiles, and note-type schemas.
# The Obsidian settings UI is a view over this file; edits here win.
# Canonical filename: linter.yaml at the vault root. lappe-linter.yaml is an
# accepted alias; when both exist, linter.yaml wins (dec-002).

version: 1 # config schema version; only 1 is valid, do not change

defaults:
  rules: # rules applied to every file; each key is a rule id, set enabled true/false
    yaml-key-sort:
      enabled: true # sorts frontmatter keys; set false to leave key order alone
      priority-keys: [preset, domain, category, sub-category, types, date-created, date-revised, links] # keys sort in this order; aliases and tags always follow last; drag to reorder in the Lappe settings tab, or edit the list here
    yaml-timestamp:
      enabled: true # mandatory timestamps (dec-005): date-created on first lint, date-revised only when content changed; dates yyyy-MM-dd
    alphabetize-property-values:
      enabled: true # sorts the values of list properties (aliases, tags, links); never the keys
    h1-matches-stem:
      enabled: true # first H1 is kept equal to the filename stem, inserted when missing
    kebab-case-filename:
      enabled: true # reports filenames that are not kebab-case; rename.mode below controls fixing

profiles: # named per-scope overrides; a file matching a profile gets its rules on top of defaults
  tasks-notes: # example profile, rename or delete it freely
    match:
      frontmatter: {category: task} # applies to files whose frontmatter has category: task
    rules: {} # per-rule overrides for matched files, same shape as defaults.rules

note-types: {} # frontmatter schemas per note type; add entries like "task:" with required keys, key-order, and allowed values

templates: {} # property-based templates: a global base every note inherits plus scoped children; e.g. global: {pinned-keys: [domain, category], body: "# {{title}}"} and by-scope: [{name: projects, match: {path: ["Projects/**"]}, toggles: {aliases: off}}]

automations: [] # rule/automation bindings deciding when and how linting runs; e.g. {name: lint-on-write, trigger: on-write, action: fix, failure: open}, {name: gate, trigger: pre-commit, action: check, failure: closed}

code-checks: {} # declarative code linting over fenced code blocks (dec-006); enable built-ins like "no-token-shaped-strings: {enabled: true}" or define your own {pattern, languages, message}; patterns are bounded regex, never executed code

rename:
  mode: flag # filename rule behavior: off = disabled, flag = report only, rename = fix filenames and update links

ignore:
  folders: [] # vault-relative folders the linter never touches, e.g. [templates, .obsidian]
  files: [] # vault-relative files the linter never touches, e.g. [inbox/scratch.md]
`;
}

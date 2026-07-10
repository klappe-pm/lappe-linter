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
      priority-keys: [domain, category, sub-category, date-created, date-revised] # these keys always sort first, in this order; edit the list to change your canonical order

profiles: # named per-scope overrides; a file matching a profile gets its rules on top of defaults
  tasks-notes: # example profile, rename or delete it freely
    match:
      frontmatter: {category: task} # applies to files whose frontmatter has category: task
    rules: {} # per-rule overrides for matched files, same shape as defaults.rules

note-types: {} # frontmatter schemas per note type; add entries like "task:" with required keys, key-order, and allowed values

rename:
  mode: flag # filename rule behavior: off = disabled, flag = report only, rename = fix filenames and update links

ignore:
  folders: [] # vault-relative folders the linter never touches, e.g. [templates, .obsidian]
  files: [] # vault-relative files the linter never touches, e.g. [inbox/scratch.md]
`;
}

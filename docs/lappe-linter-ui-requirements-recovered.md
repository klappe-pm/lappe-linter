---
domain: harness
category: lappe-linter
sub-category: ui-requirements
date-created: 2026-07-21
date-revised: 2026-07-21
type: reference
status: REVIEW
aliases: []
tags: []
---

# lappe-linter-ui-requirements-recovered

## Provenance

Recovered from Claude Code session transcripts under `~/.claude/projects/**/*.jsonl`, window 2026-07-01 to 2026-07-18. All genuine human UI/design requirements were authored in two home-directory orchestration sessions on 2026-07-10, not in the linter's own project session history (every user turn in the `lappe-linter/` project dirs is an auto-generated `/security-review` prompt, which is why these felt missing from working context).

- Master spec: `~/.claude/projects/-Users-kevinlappe/126cab29-87c8-4b31-8b03-898f76d8cacf.jsonl` line 8, ts 2026-07-10T18:46:30Z.
- Refinements: `~/.claude/projects/-Users-kevinlappe/f8a195f6-85c3-4711-8d1c-e2358877bfca.jsonl` lines 171, 618, 629, 640, 720, 846, 1067, 1524.
- Follow-ups confirming non-delivery: `126cab29...jsonl` lines 1968, 2004, 2075, 2091, 2096.

Notes: `dolphin-linter` produced zero hits anywhere; every match is `lappe-linter` (earlier name `linter-obsidian-fork`). The `product-management-plugin` co-occurrence is incidental (sibling-repo mention); no session mixes linter UI requirements with product-management-plugin requirements. The user references "requirements and mocks" (line 2004) but no mock image survives in the JSONL; if visual mocks exist they were shared out-of-band.

The linter is an Obsidian plugin (hard fork of `platers/obsidian-linter`), so "frontend/UI" means the plugin settings tab, ribbon icon, command palette, and an in-settings live-preview pane, not a web dashboard or CLI GUI.

## Master spec (verbatim user turn)

```markdown
cd lappe-linter : Here's a cleaned-up version you can use as an LLM/dev prompt:

I forked the Obsidian Linter plugin and renamed it **Lappe Linter**. I need help fixing and redesigning the plugin settings and behavior.

## Current Problem

I tested the plugin in a brand-new Obsidian vault after fully quitting and restarting Obsidian. Nothing changed. The wand command does not work.

There also appears to be no working scoping by:
- Folder
- Property
- Tag
- File path

Please debug why the plugin is not applying linting changes and why the wand action does nothing.

## YAML / Frontmatter Settings

Simplify the YAML settings section. Remove the current "YAML Common Style" and "YAML Hidden" structure.
The YAML section should focus only on these features.

### Default YAML Key Order
The default YAML keys should appear in this order:
1. `preset`
2. `domain`
3. `category`
4. `sub-category`
5. `types`
6. `date-created`
7. `date-revised`
8. `links`
9. `aliases`
10. `tags`
11. Blank key/value row

The user should be able to reorder these keys with drag and drop.
Remove the separate "key sort" option because drag-and-drop ordering replaces it.

### YAML Key / Value Entry UX
For both keys and values:
- Show all existing vault values alphabetically.
- As the user types, narrow the list.
- Default to one blank key/value row.
- Use the same design pattern for adding and removing YAML rows.
- "Insert" should be replaced by drag-and-drop ordering.

### YAML Options To Keep
Keep these options:
- Add blank line after YAML
- Dedupe YAML array values
- Remove YAML keys/values using the same drag-and-drop row pattern
- YAML timestamp fields: `date-created`, `date-updated`

Remove these options:
- Title alias
- YAML title
- Footnote-related options

All remaining YAML toggle options should default to ON, so users opt out rather than opt in.

## Headers

Rename the settings section from **Heading** to **Headers**.
Change "Capitalize headings" into per-header-level formatting controls.
Each header level should support these formatting options, shown alphabetically:
- `camelCase`
- `First letter`
- `kebab-case`
- `Title Case`
- `underscore_formatted`

### Header Defaults
- File title is the first source option.
- Default title format is `kebab-case`.
- When a file is created, ignore Obsidian's default `Untitled` filename.
- Once the user enters a real filename, the linter should watch the file and format on paste.
- The formatted filename should automatically set the H1 header value.
- H2 and H3 should follow the configured header rules.

Keep these options:
- Header increment, default ON
- Include heading start line, default ON
- Trailing spaces, default ON

## Rename Content To Body

Rename the **Content** settings section to **Body**.
Organize Body settings like this:
Basic Styling
Bold
Underscore
Italics

## Live Preview / Side-by-Side View

The plugin should have a more ambitious settings experience.
When configuring rules, open a side-by-side preview:
- Left pane: a live example note showing the output of the current lint settings.
- Right pane: the plugin settings panel.

For example:
- If H1 is set to `kebab-case`, the preview should show the H1 updated.
- If H2 is set to `camelCase`, the preview should show H2 updated.
- If paragraph spacing changes, the preview should update.
- If line breaks are removed, the preview should update.

The preview can use a single sample file/note with:
- YAML frontmatter
- H1, H2, H3 examples
- Paragraph text
- Bullet lists
- Bold, italics, and underscore examples
- Code blocks
- Quotes
- Tables
- Callouts
Use simple placeholder text where needed.

## Paragraph And Line Spacing

Add controls for paragraph spacing:
- Number of blank lines between paragraphs
- Valid options: `0`, `1`, or `2`

For bullet lists:
- Default should be no blank lines between bullet points.
- Bullet marker options: `-` followed by one space, `*` followed by one space
Default bullet style should be `- `.

Add an option to remove artificial line breaks, such as breaks created by pasted text, Gmail, AI-generated text, or text wrapped based on window size.
The goal is:
- Lines should wrap naturally.
- Lines should not be hard-broken into fixed-width columns.

## Priority / Rule Ordering

Add a priority-order control.
The first/default rule should have a lock icon to indicate that its order is fixed.
For the remaining rules, provide sorting options:
- Manual order
- Alphabetical order
This should apply globally and also inside scoped settings.

## Special Formatting Section

Create a separate section for special formatting rules, including:
- Code blocks
- Quotes
- Tables
- Callouts
- Other Markdown-specific formatting
This section should use the same base layout pattern as the Body and YAML settings.

## Scoping System

Build a reusable scoping system. The base settings should become the template for scoped configurations.
Supported scope types:
- Folder, File, File path, Properties, Tags, Backlinks, Aliases, Domain, Category, Sub-category, Date created, Date revised, Age, Project, Types
Add `project` as a default option under `types`.
All scoping selectors should support multi-select.

### Age Scope
Age should be calculated as: today - date-created
Display age in day ranges using 5-day increments: `1-5`, `6-10`, `11-15`, etc.
If the note was created today, round up to `1`.

## Scoping UI

Create a section where the user selects one or more scope types.
Flow:
1. User chooses scope type from a dropdown.
2. Dropdown supports multi-select.
3. As the user selects scope types, matching configuration fields appear to the right.
4. The menu closes when the user clicks outside it.
5. The live preview on the left updates as scoped settings are configured.

Example:
- User selects `folder` and `tag`.
- The UI shows folder and tag selector fields.
- User configures formatting rules for that scoped combination.
- Preview updates to show what a matching note would look like.

## Template Inheritance

The base settings act as the default template.
Scoped configurations should inherit from the base template unless they override specific options.
If a base template setting changes later, that change should propagate to all scoped configurations that have not explicitly overridden that setting.
This should work similarly to project-level permission inheritance in Claude-style settings:
- Base template provides defaults.
- Scoped configuration can override.
- Non-overridden values stay linked to the template.
There should also be an explicit action to push template changes through to associated scoped configurations.

## YAML Metadata Integration

Hook scoped settings and inheritance into YAML frontmatter where appropriate.
The plugin should be able to use YAML metadata such as: preset, domain, category, sub-category, types, project, date-created, date-revised, tags, aliases, links.
These values should drive scope matching and preview behavior.

## Expected Output

Please help me:
1. Debug why the wand action does not work.
2. Confirm whether the plugin is loading correctly in a fresh Obsidian vault.
3. Identify why linting changes are not being applied.
4. Redesign the settings architecture around: YAML, Headers, Body, Special Markdown formatting, Scoping, Live preview, Template inheritance
5. Propose the implementation plan and code changes needed.
```

## Refinement turns (verbatim, typos preserved)

f8a195f6 L171: `/btw, rename this to the lappe-linter; and make it easy for me to add new linting capabilities and /or changemy preferneces.`

f8a195f6 L629: `i mean this looks like a good copy, much easier to navigtate, but i don't think you added the featrure si originally askled for`

f8a195f6 L640: `eg. lint tied to a file path, folder, tag, propertyu, etc. bolded text, italics, etc.`

f8a195f6 L720: `also simplify the yaml sort oreder windows. they're way too small just make it a bigger biox where you can actually see the array being put in. inmfact get ride of the single cell entry. add an input that when clicked into shows all yaml keys alphebtcailly an autofill asyou type, then if you hit enter you gert a new value etc. next to teh vlaues, there is another field that has trhe asme patter. for both you can add new. simpifyu this and make only ciobined "this is the order yaml keys get sorted in"`

f8a195f6 L846: `'t need this. yaml timestamp ius mandatory, and the defautl values are date-created and date-revised; all dates are mandatory yyyy-MM-dd foramt time is HHmm. remove yaml title aliasremove yaml titleremove yaml key sort in favor of the single input fescribed abovcewremove all options for soreting and repalce with "alphbetize peroperies (which is yes alpahbercizse all of the properies on lines (the values not the keys , so aliases, tags, linsk, etcv, rem,ove // basically make teh yaml section just the entr4y field i asked for easleri, the rest is not neexced// h1 kebab case is on by defautl, h1 matches files namem, if no file nam. simpoify all of the white space into oine sections. there way to much hopimg aorund. make teh content styling siumper. for each, just priociudef trhe visual option that is avilable. remove all paste remove footnote. add in all of teh requested astyling, and a button that links to a style fiule i can use to automnatically update tehstyl9ng or overirde, so there cna be a folde with mulpes styles, and this is whrer the bny folder defintions will live. these will be stored alongside the sxiring one. there needs ot be a way to conencte them all together anf mange5r ht,e`

f8a195f6 L618: `test vault does not work, give me the plugin file i can drop into .obsidian directlyy`

f8a195f6 L1067: `run a detailed and comprehesive security analysis on this plugin. then simualkteanoeuly look for wasy to reduce the wize of it to make more efficent, but still detlightful to user. ensure that teh plug int is also properly code commented, and docuemnnted when done with the asemi aggressive reiew and critique and round of revisions. then create a freature that generate a complte et of test files ina folder under _archive/{yyyy-MM-dd-lappe-linter-test-files}, then ensure htere is a checkbox screen where "ecluded folders are possible, and add all of these test. then pick a cool lcuide.dev icon, place in in the left hand quick action, add a hoteley support, , then add in a feature for code linting. this will be defined by the integrqated coding projets in the vault. use the harness project as a guide. looks at the hooks, rules, etc. how could these be expressed in the lappe linter. again securly sanf afely.`

f8a195f6 L1524: `what about all of the features and redesign i explcitly told you to implement`

126cab29 L1968: `did you build the features i told you to build, eg the side by side view?`

126cab29 L2004: `there is no lappe tab. wtf are you actually doing right now. i gave you rquirements and mocks and you fucking ended up here`

126cab29 L2075 / L2091: `there is no lappe tab, stop fukcing making lappe tab`

126cab29 L2096: `what did you jsut now realize the direction i wrote an gave to you? this means you wasted 4 hours of work`

## Consolidated feature list

- A dedicated plugin settings tab ("Settings").
- Left-ribbon quick-action icon (a lucide.dev icon, e.g. wand-sparkles), plus a keyboard hotkey, both running lint-current-file.
- Working wand command / command-palette entry that actually applies lint changes.
- Side-by-side live preview inside settings: left pane renders a sample note reflecting current settings, right pane is the settings panel; updates live as any rule changes.
- YAML section: single combined key-order entry field, drag-and-drop reordering (replaces "key sort" and "Insert"), alphabetical autocomplete that narrows as you type, one blank key/value row by default, same add/remove row pattern for keys and values, bigger input boxes (not tiny single cells).
- Toggles default ON (opt-out model).
- Headers section renamed from "Heading"; per-header-level case-format controls listed alphabetically (camelCase, First letter, kebab-case, Title Case, underscore_formatted); H1 kebab-case default, H1 matches filename.
- Content section renamed to "Body" with a Basic Styling grouping (Bold, Underscore, Italics); collapse excess whitespace/sections.
- Separate Special Formatting section (code blocks, quotes, tables, callouts) using the same layout pattern as Body/YAML.
- Priority/rule-ordering control with a lock icon on the fixed first rule; manual or alphabetical sort, global and per-scope.
- Scoping UI: multi-select dropdown of scope types (folder, file, path, property, tag, backlink, alias, domain, category, sub-category, date-created, date-revised, age, project, types); selected types reveal matching config fields to the right; menu closes on outside click; preview updates per scope; age shown in 5-day range buckets.
- Template inheritance: base settings are the default template, scopes inherit and can override, changes propagate to non-overridden scopes, with an explicit "push template changes" action.
- A styles system: a button linking to a style file to auto-apply/override styling, a folder holding multiple style definitions stored alongside existing config, connected and manageable together.
- Excluded-folders checkbox screen (a checkbox per vault folder).
- A test-files generator writing fixtures under `_archive/{yyyy-MM-dd-lappe-linter-test-files}`.
- Deliverable format: a droppable plugin file for `.obsidian`, installable and testable locally.

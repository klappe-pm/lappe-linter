import * as fs from 'fs';
import * as path from 'path';
import {
  FileFacts,
  LinterConfig,
  makeTemplateEvent,
  ProfileMatch,
  renderTemplate,
  resolveNamedTemplate,
  resolveTemplate,
  toJsonl,
} from '@lappe-linter/core';
import {CliFlags} from './args';
import {ConfigCache, ConfigResult} from './config-discovery';
import {CliIo} from './io';
import {reportConfigErrors, toVaultPath} from './lint-run';
import {matchKinds, newRunId, nowIso, repoOf, triggerOf} from './telemetry';

/**
 * `template` command: inspect and apply property-based templates from the
 * resolved linter.yaml. Applying to an EXISTING note is preview-only (no
 * silent rewrite; the destructive apply contract is DEC-104); only a new file
 * is scaffolded to disk.
 */

function loadConfig(flags: CliFlags, io: CliIo, cache: ConfigCache, startDir: string): ConfigResult {
  return flags.config !== undefined ? cache.loadPath(flags.config, io.cwd) : cache.forDir(startDir);
}

/** Extract the raw frontmatter YAML text (no fences) for scope matching, or null. */
function rawFrontmatter(text: string): string | null {
  const lines = text.split('\n');
  if (lines[0] !== '---') {
    return null;
  }
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      return lines.slice(1, i).join('\n');
    }
  }
  return null;
}

/** Shallow top-level frontmatter keys, for pinned-key conformance checks. */
function frontmatterKeys(raw: string | null): Set<string> {
  const keys = new Set<string>();
  if (raw === null) {
    return keys;
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^([\w-]+):/);
    if (m) {
      keys.add(m[1]);
    }
  }
  return keys;
}

function stemOf(p: string): string {
  return path.basename(p).replace(/\.md$/, '');
}

/** scope_matched and toggles_overridden for a resolved template, for telemetry. */
function scopeInfo(config: LinterConfig, name: string | null): {scopeMatched: string[]; togglesOff: string[]} {
  if (name === null) {
    return {scopeMatched: [], togglesOff: []};
  }
  const entry = (config.templates?.['by-scope'] ?? []).find((t) => t.name === name);
  if (!entry) {
    return {scopeMatched: [], togglesOff: []};
  }
  const togglesOff = Object.entries(entry.toggles ?? {})
      .filter(([, v]) => v === false || v === 'off')
      .map(([k]) => k);
  return {scopeMatched: matchKinds(entry.match), togglesOff};
}

function describeMatch(match: ProfileMatch | undefined): string {
  if (!match) {
    return '(no scope; explicit only)';
  }
  const parts: string[] = [];
  if (match.path?.length) parts.push(`path:${match.path.join('|')}`);
  if (match.extension?.length) parts.push(`ext:${match.extension.join('|')}`);
  if (match.frontmatter) {
    parts.push(...Object.entries(match.frontmatter).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`));
  }
  if (match.tag?.length) parts.push(`tag:${match.tag.join('|')}`);
  if (match.age?.length) parts.push(`age:${match.age.join('|')}`);
  return parts.length ? parts.join(' ') : '(no scope; explicit only)';
}

export function runTemplate(
    paths: string[],
    flags: CliFlags,
    io: CliIo,
    cache: ConfigCache,
    today: string,
): number {
  const sub = paths[0];
  if (sub === 'list') {
    return templateList(flags, io, cache);
  }
  if (sub === 'show') {
    return templateShow(paths[1], flags, io, cache, today);
  }
  // apply | check
  return templateApply(sub, paths.slice(1), flags, io, cache, today);
}

function templateList(flags: CliFlags, io: CliIo, cache: ConfigCache): number {
  const cfg = loadConfig(flags, io, cache, io.cwd);
  if (!cfg.ok) {
    reportConfigErrors(cfg.messages, io);
    return 2;
  }
  const templates = cfg.loaded.config.templates;
  if (!templates || (!templates.global && !templates['by-scope']?.length)) {
    io.stdout('no templates configured\n');
    return 0;
  }
  if (templates.global) {
    const g = templates.global;
    const pinned = g['pinned-keys']?.join(', ') || '-';
    io.stdout(`GLOBAL  base template   pinned: ${pinned}   body: ${g.body ? 'yes' : 'no'}\n`);
  }
  for (const t of templates['by-scope'] ?? []) {
    const toggles = t.toggles ? Object.entries(t.toggles).map(([k, v]) => `${k}=${v === false ? 'off' : v}`).join(' ') : '';
    io.stdout(`SCOPED  ${t.name}   ${describeMatch(t.match)}${toggles ? `   toggles: ${toggles}` : ''}\n`);
  }
  return 0;
}

function templateShow(name: string, flags: CliFlags, io: CliIo, cache: ConfigCache, today: string): number {
  const cfg = loadConfig(flags, io, cache, io.cwd);
  if (!cfg.ok) {
    reportConfigErrors(cfg.messages, io);
    return 2;
  }
  const resolved = resolveNamedTemplate(cfg.loaded.config, name);
  if (!resolved) {
    io.stderr(`lappe-linter: unknown template "${name}"\n`);
    return 2;
  }
  io.stdout(`template: ${name}\n`);
  io.stdout(`chain: ${resolved.chain.join(' -> ')}\n`);
  io.stdout(`pinned-keys: ${resolved.pinnedKeys.join(', ') || '-'}\n`);
  io.stdout('--- rendered preview ---\n');
  io.stdout(renderTemplate(resolved, {title: stemOf(name), today}));
  return 0;
}

function templateApply(
    sub: string,
    targets: string[],
    flags: CliFlags,
    io: CliIo,
    cache: ConfigCache,
    today: string,
): number {
  const runId = newRunId();
  const trigger = triggerOf(flags);
  let nonConforming = 0;
  for (const target of targets) {
    const abs = path.resolve(io.cwd, target);
    const cfg = flags.config !== undefined ? cache.loadPath(flags.config, io.cwd) : cache.forDir(path.dirname(abs));
    if (!cfg.ok) {
      reportConfigErrors(cfg.messages, io);
      return 2;
    }
    const exists = fs.existsSync(abs);
    const existingText = exists ? fs.readFileSync(abs, 'utf8') : null;
    const relPath = toVaultPath(cfg.loaded.configDir, abs);
    const facts: FileFacts = {path: relPath, frontmatter: existingText ? rawFrontmatter(existingText) : null, today};
    const resolved = resolveTemplate(facts, cfg.loaded.config);
    if (!resolved) {
      if (!flags.json) {
        io.stdout(`no-template  ${relPath}\n`);
      }
      continue;
    }

    // Human output is suppressed under --json so the stream stays pure JSONL;
    // the template-event carries the same facts a report would need.
    let mode: 'apply' | 'preview' = 'preview';
    if (sub === 'check') {
      const present = frontmatterKeys(existingText ? rawFrontmatter(existingText) : null);
      const missing = resolved.pinnedKeys.filter((k) => !present.has(k));
      if (missing.length) {
        nonConforming += 1;
        if (!flags.json) {
          io.stdout(`${relPath}: template ${resolved.name ?? 'global'}: missing pinned keys ${missing.join(', ')}\n`);
        }
      }
    } else {
      const rendered = renderTemplate(resolved, {title: stemOf(target), today});
      if (exists) {
        if (!flags.json) {
          io.stdout(`--- ${relPath} (exists; preview only, not overwritten) ---\n`);
          io.stdout(rendered);
        }
      } else if (flags.dryRun) {
        if (!flags.json) {
          io.stdout(`--- ${relPath} (new; dry-run) ---\n`);
          io.stdout(rendered);
        }
      } else {
        fs.mkdirSync(path.dirname(abs), {recursive: true});
        fs.writeFileSync(abs, rendered);
        mode = 'apply';
        if (!flags.json) {
          io.stdout(`wrote ${relPath} from template ${resolved.name ?? 'global'}\n`);
        }
      }
    }

    if (flags.json) {
      const info = scopeInfo(cfg.loaded.config, resolved.name);
      io.stdout(toJsonl(makeTemplateEvent({
        ts: nowIso(),
        run_id: runId,
        trigger,
        repo: repoOf(cfg.loaded.configDir),
        path: relPath,
        template: resolved.name ?? 'global',
        scope_matched: info.scopeMatched,
        keys_applied: Object.keys(resolved.frontmatter),
        toggles_overridden: info.togglesOff,
        mode,
      })));
    }
  }
  return sub === 'check' && nonConforming > 0 ? 1 : 0;
}

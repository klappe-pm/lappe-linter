import * as fs from 'fs';
import * as path from 'path';
import {LinterConfig, LintTextResult, lintText, proposeRename} from '@lappe-linter/core';
import {CliFlags} from './args';
import {ConfigCache, ConfigResult, LoadedConfig} from './config-discovery';
import {CliIo} from './io';
import {FileReport, jsonLine} from './json-output';

/**
 * check/fix orchestration over the shared core lint entry. Everything rule-
 * and scope-related happens inside core's lintText; this module only walks
 * the filesystem, honors ignore config, and shapes output (F06 R1).
 */

export type TargetResult = {ok: true; files: string[]} | {ok: false; message: string};

const SKIPPED_DIRS = new Set(['node_modules', '.git']);

function walkMarkdown(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir).sort()) {
    if (entry.startsWith('.') || SKIPPED_DIRS.has(entry)) {
      continue;
    }
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      out.push(...walkMarkdown(full));
    } else if (entry.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

export function expandTargets(paths: string[], cwd: string): TargetResult {
  const files: string[] = [];
  for (const p of paths) {
    const abs = path.resolve(cwd, p);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(abs);
    } catch {
      return {ok: false, message: `no such file or directory: ${p}`};
    }
    if (stat.isDirectory()) {
      files.push(...walkMarkdown(abs));
    } else {
      files.push(abs);
    }
  }
  return {ok: true, files: [...new Set(files)]};
}

/** Config-dir-relative posix path; falls back to the absolute path outside it. */
export function toVaultPath(configDir: string, fileAbs: string): string {
  const rel = path.relative(configDir, fileAbs);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    return fileAbs.split(path.sep).join('/');
  }
  return rel.split(path.sep).join('/');
}

export function isIgnored(config: LinterConfig, relPath: string): boolean {
  const ignore = config.ignore;
  if (!ignore) {
    return false;
  }
  for (const folder of ignore.folders ?? []) {
    const normalized = folder.replace(/\/+$/, '');
    if (normalized !== '' && (relPath === normalized || relPath.startsWith(`${normalized}/`))) {
      return true;
    }
  }
  return (ignore.files ?? []).includes(relPath);
}

export function configFor(fileAbs: string, flags: CliFlags, io: CliIo, cache: ConfigCache): ConfigResult {
  return flags.config !== undefined ?
    cache.loadPath(flags.config, io.cwd) :
    cache.forDir(path.dirname(fileAbs));
}

export function reportConfigErrors(messages: string[], io: CliIo): void {
  for (const message of messages) {
    io.stderr(`lappe-linter: ${message}\n`);
  }
}

interface LintedFile {
  relPath: string;
  loaded: LoadedConfig;
  result: LintTextResult;
}

function lintOne(fileAbs: string, loaded: LoadedConfig, today: string): LintedFile | null {
  const relPath = toVaultPath(loaded.configDir, fileAbs);
  if (isIgnored(loaded.config, relPath)) {
    return null;
  }
  const text = fs.readFileSync(fileAbs, 'utf8');
  const result = lintText({text, path: relPath, config: loaded.config, today});
  return {relPath, loaded, result};
}

function profileOf(result: LintTextResult): string {
  return result.profileChain[result.profileChain.length - 1];
}

export function runCheck(files: string[], flags: CliFlags, io: CliIo, cache: ConfigCache, today: string): number {
  let violationCount = 0;
  for (const fileAbs of files) {
    const cfg = configFor(fileAbs, flags, io, cache);
    if (!cfg.ok) {
      reportConfigErrors(cfg.messages, io);
      return 2;
    }
    const linted = lintOne(fileAbs, cfg.loaded, today);
    if (linted === null) {
      continue;
    }
    violationCount += linted.result.violations.length;
    if (flags.json) {
      const report: FileReport = {
        path: linted.relPath,
        profile: profileOf(linted.result),
        violations: linted.result.violations,
        renamedTo: null,
      };
      io.stdout(jsonLine(report));
    } else {
      for (const v of linted.result.violations) {
        io.stdout(`${linted.relPath}: ${v.rule}: ${v.message}\n`);
      }
    }
  }
  return violationCount > 0 ? 1 : 0;
}

function maybeRename(fileAbs: string, linted: LintedFile, flags: CliFlags, io: CliIo): string | null {
  if (!flags.allowRename || linted.loaded.config.rename?.mode !== 'rename') {
    return null;
  }
  const proposal = proposeRename(linted.relPath);
  if (proposal === null) {
    return null;
  }
  const targetAbs = path.join(path.dirname(fileAbs), proposal.proposed + path.extname(fileAbs));
  if (fs.existsSync(targetAbs)) {
    io.stderr(`lappe-linter: skip rename of ${linted.relPath}: ${proposal.proposed} already exists\n`);
    return null;
  }
  fs.renameSync(fileAbs, targetAbs);
  return toVaultPath(linted.loaded.configDir, targetAbs);
}

export function runFix(files: string[], flags: CliFlags, io: CliIo, cache: ConfigCache, today: string): number {
  for (const fileAbs of files) {
    const cfg = configFor(fileAbs, flags, io, cache);
    if (!cfg.ok) {
      reportConfigErrors(cfg.messages, io);
      return 2;
    }
    const linted = lintOne(fileAbs, cfg.loaded, today);
    if (linted === null) {
      continue;
    }
    if (linted.result.changed) {
      fs.writeFileSync(fileAbs, linted.result.text);
    }
    const renamedTo = maybeRename(fileAbs, linted, flags, io);
    if (flags.json) {
      const report: FileReport = {
        path: linted.relPath,
        profile: profileOf(linted.result),
        violations: linted.result.violations,
        renamedTo,
      };
      io.stdout(jsonLine(report));
    } else if (renamedTo !== null) {
      io.stdout(`${linted.relPath} -> ${renamedTo}\n`);
    } else if (linted.result.changed) {
      io.stdout(`${linted.relPath}\n`);
    }
  }
  return 0;
}

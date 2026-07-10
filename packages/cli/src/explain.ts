import * as fs from 'fs';
import * as path from 'path';
import {getRule, resolveProfile} from '@lappe-linter/core';
import {CliFlags} from './args';
import {ConfigCache} from './config-discovery';
import {CliIo} from './io';
import {configFor, isIgnored, reportConfigErrors, toVaultPath} from './lint-run';

/**
 * explain <path>: the CLI twin of the plugin inspector. Prints which config
 * file governs the path, the resolved profile chain, the note type, and the
 * per-rule enabled state after precedence merge.
 */

function extractFrontmatter(text: string): string | null {
  const lines = text.split('\n');
  if ((lines[0] ?? '').replace(/\r$/, '') !== '---') {
    return null;
  }
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].replace(/\r$/, '') === '---') {
      return lines.slice(1, i).join('\n');
    }
  }
  return null;
}

export function runExplain(target: string, flags: CliFlags, io: CliIo, cache: ConfigCache): number {
  const fileAbs = path.resolve(io.cwd, target);
  if (!fs.existsSync(fileAbs) || !fs.statSync(fileAbs).isFile()) {
    io.stderr(`lappe-linter: no such file: ${target}\n`);
    return 2;
  }
  const cfg = configFor(fileAbs, flags, io, cache);
  if (!cfg.ok) {
    reportConfigErrors(cfg.messages, io);
    return 2;
  }
  const {config, configDir, configPath} = cfg.loaded;
  const relPath = toVaultPath(configDir, fileAbs);
  const text = fs.readFileSync(fileAbs, 'utf8');
  const resolved = resolveProfile({path: relPath, frontmatter: extractFrontmatter(text)}, config);

  io.stdout(`path: ${relPath}\n`);
  io.stdout(`config: ${configPath}\n`);
  io.stdout(`ignored: ${isIgnored(config, relPath)}\n`);
  io.stdout(`profile chain: ${resolved.chain.join(' -> ')}\n`);
  io.stdout(`note type: ${resolved.noteType ?? '(none)'}\n`);
  io.stdout('rules:\n');
  const entries = Object.entries(resolved.rules);
  if (entries.length === 0) {
    io.stdout('  (none configured)\n');
    return 0;
  }
  for (const [id, stanza] of entries) {
    const state = stanza.enabled === true ? 'enabled' : 'disabled';
    const description = getRule(id)?.description;
    io.stdout(`  ${id}: ${state}${description === undefined ? '' : `  ${description}`}\n`);
  }
  return 0;
}

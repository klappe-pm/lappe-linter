import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {CliFlags} from './args';
import {CliIo} from './io';
import {readJsonlInput} from './report';

/**
 * `export`: write a checksummed, secret-scrubbed JSONL bundle for cross-container
 * data sharing (WS-F). v1 is deliberately manual: the operator drops the bundle
 * on the session-data path, host ingest is the sole sessions.db writer. The
 * bundle is named by its own content hash, so re-exporting identical data is
 * idempotent and the manifest lets the importer verify integrity.
 */

// Telemetry events carry rule ids, paths, and counts — not credentials — but
// export is a data-egress boundary, so obvious secret shapes are redacted anyway.
const SECRET_PATTERNS: RegExp[] = [
  /\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{20,}\b/g,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
];

export function scrubLine(line: string): string {
  let out = line;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, '***redacted***');
  }
  return out;
}

export async function runExport(flags: CliFlags, io: CliIo): Promise<number> {
  const text = await readJsonlInput(flags, io);
  if (text === null) {
    return 2;
  }

  const scrubbed = text.split('\n').filter((line) => line.trim() !== '').map(scrubLine);
  const body = scrubbed.length ? `${scrubbed.join('\n')}\n` : '';
  const sha = crypto.createHash('sha256').update(body).digest('hex');
  const bundleName = `lappe-export-${sha.slice(0, 12)}.jsonl`;

  const outRel = flags.out ?? '.';
  const outDir = path.resolve(io.cwd, outRel);
  try {
    fs.mkdirSync(outDir, {recursive: true});
    fs.writeFileSync(path.join(outDir, bundleName), body);
    const manifest = {
      bundle: bundleName,
      sha256: sha,
      lines: scrubbed.length,
      format: 'jsonl',
      tool: 'lappe-linter',
    };
    fs.writeFileSync(path.join(outDir, `${bundleName}.manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  } catch (err) {
    io.stderr(`lappe-linter: cannot write export to ${outRel}: ${(err as Error).message}\n`);
    return 2;
  }

  io.stdout(`wrote ${path.join(outRel, bundleName)} (${scrubbed.length} lines, sha256 ${sha.slice(0, 12)})\n`);
  return 0;
}

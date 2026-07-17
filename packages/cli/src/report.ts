import * as fs from 'fs';
import * as path from 'path';
import {aggregateEvents, renderReportMarkdown} from '@lappe-linter/core';
import {CliFlags} from './args';
import {CliIo} from './io';

/**
 * Read the telemetry JSONL for report/export: --input <file> or, absent that,
 * stdin. Returns null (after reporting) when the file cannot be read.
 */
export async function readJsonlInput(flags: CliFlags, io: CliIo): Promise<string | null> {
  if (flags.input !== undefined) {
    const abs = path.resolve(io.cwd, flags.input);
    try {
      return fs.readFileSync(abs, 'utf8');
    } catch (err) {
      io.stderr(`lappe-linter: cannot read ${flags.input}: ${(err as Error).message}\n`);
      return null;
    }
  }
  return io.readStdin();
}

/**
 * `report`: fold a telemetry JSONL stream (template-events, run-summaries, lint
 * FileReport lines) into a usage/lint rollup. Reads --input <file> or stdin,
 * renders Markdown by default or JSON with --json. This is the local surface
 * that produces the committed docs/reports/lint/*.{md,json} artifacts.
 */
export async function runReport(flags: CliFlags, io: CliIo): Promise<number> {
  const text = await readJsonlInput(flags, io);
  if (text === null) {
    return 2;
  }

  const summary = aggregateEvents(text.split('\n'), flags.since ?? null);
  if (flags.json) {
    io.stdout(`${JSON.stringify(summary)}\n`);
  } else {
    io.stdout(`${renderReportMarkdown(summary)}\n`);
  }
  return 0;
}

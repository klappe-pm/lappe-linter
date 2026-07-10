import * as fs from 'fs';
import * as path from 'path';
import {scaffoldConfig} from '@lappe-linter/core';
import {CliIo} from './io';

/**
 * init: write the commented starter linter.yaml to the current directory.
 * Idempotent: an existing linter.yaml is never overwritten.
 */
export function runInit(io: CliIo): number {
  const target = path.join(io.cwd, 'linter.yaml');
  if (fs.existsSync(target)) {
    io.stdout('linter.yaml already exists; leaving it unchanged\n');
    return 0;
  }
  fs.writeFileSync(target, scaffoldConfig());
  io.stdout('wrote linter.yaml\n');
  return 0;
}

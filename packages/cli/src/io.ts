/**
 * IO seam for the CLI. Commands write through CliIo instead of touching
 * process streams directly, so tests run commands in-process and capture
 * output without spawning.
 */

export interface CliIo {
  cwd: string;
  stdout(text: string): void;
  stderr(text: string): void;
  readStdin(): Promise<string>;
}

export function realIo(): CliIo {
  return {
    cwd: process.cwd(),
    stdout: (text) => {
      process.stdout.write(text);
    },
    stderr: (text) => {
      process.stderr.write(text);
    },
    readStdin: () =>
      new Promise((resolve, reject) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk: string) => {
          data += chunk;
        });
        process.stdin.on('end', () => resolve(data));
        process.stdin.on('error', reject);
      }),
  };
}

import * as fs from 'fs';
import * as path from 'path';
import {CONFIG_FILENAME_ALIASES, LinterConfig, parseLinterConfig} from '@lappe-linter/core';

/**
 * Config discovery and loading. Discovery walks UP from each target file's
 * directory; within one directory linter.yaml beats lappe-linter.yaml
 * (dec-002, CONFIG_FILENAME_ALIASES order). Loading fails closed: an invalid
 * config never yields a partial apply, the caller must exit 2.
 */

export interface LoadedConfig {
  config: LinterConfig;
  configPath: string;
  /** Directory of the config file; acts as the vault root for relative paths. */
  configDir: string;
  warnings: string[];
}

export type ConfigResult = {ok: true; loaded: LoadedConfig} | {ok: false; messages: string[]};

export function discoverConfigPath(startDir: string): string | null {
  let dir = path.resolve(startDir);
  for (;;) {
    for (const name of CONFIG_FILENAME_ALIASES) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/**
 * Caches parsed configs per config path and discovery per start directory.
 * Reusing one LinterConfig object per config file keeps core's WeakMap
 * caches (scope compilation, provider merge) warm across files.
 */
export class ConfigCache {
  private byPath = new Map<string, ConfigResult>();
  private byDir = new Map<string, string | null>();

  loadPath(configPath: string, cwd: string): ConfigResult {
    const abs = path.resolve(cwd, configPath);
    const cached = this.byPath.get(abs);
    if (cached) {
      return cached;
    }
    const result = this.readAndParse(abs);
    this.byPath.set(abs, result);
    return result;
  }

  forDir(startDir: string): ConfigResult {
    const dir = path.resolve(startDir);
    let found = this.byDir.get(dir);
    if (found === undefined) {
      found = discoverConfigPath(dir);
      this.byDir.set(dir, found);
    }
    if (found === null) {
      return {
        ok: false,
        messages: [`no ${CONFIG_FILENAME_ALIASES.join(' or ')} found walking up from ${dir}`],
      };
    }
    return this.loadPath(found, dir);
  }

  private readAndParse(abs: string): ConfigResult {
    let text: string;
    try {
      text = fs.readFileSync(abs, 'utf8');
    } catch (err) {
      return {ok: false, messages: [`cannot read config ${abs}: ${(err as Error).message}`]};
    }
    const parsed = parseLinterConfig(text);
    if (!parsed.ok) {
      return {
        ok: false,
        messages: parsed.errors.map((e) =>
          e.path === '' ? `${abs}: ${e.message}` : `${abs}: ${e.path}: ${e.message}`,
        ),
      };
    }
    return {
      ok: true,
      loaded: {
        config: parsed.config,
        configPath: abs,
        configDir: path.dirname(abs),
        warnings: parsed.warnings,
      },
    };
  }
}

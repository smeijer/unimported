import { ProcessedResult } from './process';
import { readJson, writeJson } from './fs';
import { Context } from './index';
import glob from 'glob';
import { promisify } from 'util';
import { ensureArray } from './ensureArray';

const globAsync = promisify(glob);

export interface UnimportedConfig {
  flow?: boolean;
  entry?: string[];
  extensions?: string[];
  ignorePatterns?: string[];
  ignoreUnresolved: string[];
  ignoreUnimported: string[];
  ignoreUnused: string[];
  moduleDirectory?: string[];
}

export async function expandGlob(
  patterns: string | string[],
): Promise<string[]> {
  const set = new Set<string>();

  for (const pattern of ensureArray(patterns)) {
    const paths = await globAsync(pattern, {
      realpath: false,
    });

    for (const path of paths) {
      set.add(path);
    }
  }

  return Array.from(set);
}

export async function getConfig(): Promise<UnimportedConfig> {
  const json: Partial<UnimportedConfig> =
    (await readJson('.unimportedrc.json')) || {};

  const config = Object.assign<UnimportedConfig, Partial<UnimportedConfig>>(
    {
      ignoreUnresolved: [],
      ignoreUnimported: [],
      ignoreUnused: [],
    },
    json,
  );

  config.ignoreUnimported = await expandGlob(config.ignoreUnimported);

  if (config.entry) {
    config.entry = await expandGlob(config.entry);
  }

  return config;
}

function sort(arr) {
  const sorted = [...arr];
  sorted.sort();
  return sorted;
}

function merge(left, right) {
  return sort(Array.from(new Set([...left, ...right])));
}

export async function writeConfig(
  config: Partial<UnimportedConfig>,
  context: Context,
) {
  const cfg = Object.assign({}, context.config, config);
  await writeJson('.unimportedrc.json', cfg);
}

export async function updateAllowLists(
  files: ProcessedResult,
  context: Context,
) {
  const cfg = context.config;

  await writeConfig(
    {
      ignoreUnresolved: merge(cfg.ignoreUnresolved, files.unresolved),
      ignoreUnused: merge(cfg.ignoreUnused, files.unused),
      ignoreUnimported: merge(cfg.ignoreUnimported, files.unimported),
    },
    context,
  );
}

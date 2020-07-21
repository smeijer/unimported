import { ProcessedResult } from './process';
import { readJson, writeJson } from './fs';
import { Context } from './index';

export interface UnimportedConfig {
  flow?: boolean;
  ignorePatterns?: string[];
  ignoreUnresolved: string[];
  ignoreUnimported: string[];
  ignoreUnused: string[];
}

export async function getConfig(): Promise<UnimportedConfig> {
  const json: Partial<UnimportedConfig> =
    (await readJson('.unimportedrc.json')) || {};

  return Object.assign<UnimportedConfig, Partial<UnimportedConfig>>(
    {
      ignoreUnresolved: [],
      ignoreUnimported: [],
      ignoreUnused: [],
    },
    json,
  );
}

function sort(arr) {
  const sorted = [...arr];
  sorted.sort();
  return sorted;
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
  await writeConfig(
    {
      ignoreUnresolved: sort(files.unresolved),
      ignoreUnused: sort(files.unused),
      ignoreUnimported: sort(files.unimported),
    },
    context,
  );
}

/* eslint-disable @typescript-eslint/camelcase */
import { ProcessedResult } from './process';
import { readJson, writeJson } from './fs';
import { Context } from './index';

export interface UnimportedConfig {
  ignore_unresolved: string[];
  ignore_unimported: string[];
  ignore_unused: string[];
}

export async function getConfig(): Promise<UnimportedConfig> {
  const json: Partial<UnimportedConfig> =
    (await readJson('.unimportedrc.json')) || {};

  return Object.assign<UnimportedConfig, Partial<UnimportedConfig>>(
    {
      ignore_unresolved: [],
      ignore_unimported: [],
      ignore_unused: [],
    },
    json,
  );
}

function sort(arr) {
  const sorted = [...arr];
  sorted.sort();
  return sorted;
}

export async function updateAllowLists(
  files: ProcessedResult,
  context: Context,
) {
  const cfg = {
    ...context.config,
    ignore_unresolved: sort(files.unresolved),
    ignore_unused: sort(files.unused),
    ignore_unimported: sort(files.unimported),
  };

  await writeJson('.unimportedrc.json', cfg);
}

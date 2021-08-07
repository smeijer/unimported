import { ProcessedResult } from './process';
import { readJson, writeJson } from './fs';
import { Context } from './index';
import glob from 'glob';
import { promisify } from 'util';
import { ensureArray } from './ensureArray';
import { MapLike } from 'typescript';
import { findEntryFiles, getProjectType } from './meta';

const globAsync = promisify(glob);

const CONFIG_FILE = '.unimportedrc.json';

export interface EntryConfig {
  file: string;
  label?: string;
  aliases: MapLike<string[]>;
  extensions: string[];
}

export interface UnimportedConfig {
  flow?: boolean;
  entry?: (
    | string
    | {
        file: string;
        label?: string;
        aliases?: MapLike<string[]>;
        extensions?: string[];
        extend?: { aliases?: MapLike<string[]>; extensions?: string[] };
      }
  )[];
  ignorePatterns?: string[];
  ignoreUnresolved: string[];
  ignoreUnimported: string[];
  ignoreUnused: string[];
  moduleDirectory?: string[];
  rootDir?: string;
  extensions?: string[];
  aliases?: MapLike<string[]>;
}

export interface Config {
  preset?: string;
  flow?: boolean;
  entryFiles: EntryConfig[];
  ignorePatterns: string[];
  ignoreUnresolved: string[];
  ignoreUnimported: string[];
  ignoreUnused: string[];
  moduleDirectory?: string[];
  rootDir?: string;
  extensions: string[];
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

let cachedConfig;

export function __clearCachedConfig() {
  cachedConfig = undefined;
}

export async function getConfig(): Promise<Config> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configFile: Partial<UnimportedConfig> =
    (await readJson(CONFIG_FILE)) || {};

  const preset = await getProjectType();

  const config: Config = {
    preset,
    rootDir: configFile.rootDir,
    ignoreUnresolved: configFile.ignoreUnresolved || [],
    ignoreUnimported: await expandGlob(configFile.ignoreUnimported || []),
    ignoreUnused: configFile.ignoreUnused || [],
    ignorePatterns:
      configFile.ignorePatterns ||
      ([
        '**/node_modules/**',
        '**/*.stories.{js,jsx,ts,tsx}',
        '**/*.tests.{js,jsx,ts,tsx}',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/tests/**',
        '**/__tests__/**',
        '**/*.d.ts',
        ...(preset === 'meteor'
          ? ['packages/**', 'public/**', 'private/**', 'tests/**']
          : []),
      ].filter(Boolean) as string[]),
    entryFiles: [],
    extensions: configFile.extensions || ['.js', '.jsx', '.ts', '.tsx'],
  };

  const aliases = configFile.aliases || {};
  const extensions = config.extensions;

  if (configFile.entry) {
    for (const entry of configFile.entry) {
      if (typeof entry === 'string') {
        for (const file of await expandGlob(entry)) {
          config.entryFiles.push({
            file,
            aliases,
            extensions,
          });
        }
      } else {
        const entryAliases = entry.aliases
          ? entry.aliases
          : entry.extend?.aliases
          ? { ...aliases, ...entry.extend.aliases }
          : aliases;

        const entryExtensions = entry.extensions
          ? entry.extensions
          : entry.extend?.extensions
          ? [...entry.extend.extensions, ...extensions]
          : extensions;

        for (const file of await expandGlob(entry.file)) {
          config.entryFiles.push({
            file,
            label: entry.label,
            aliases: entryAliases,
            extensions: entryExtensions,
          });
        }
      }
    }
  }

  // try to resolve entry files based on conventions
  if (!config.entryFiles.length) {
    const entryFiles = await findEntryFiles(preset, extensions);

    for (const file of entryFiles) {
      config.entryFiles.push({
        file,
        aliases,
        extensions,
      });
    }
  }

  cachedConfig = config;

  // collect _all_ extensions for file listing
  const uniqExtensions = new Set(extensions);
  for (const entryFile of config.entryFiles) {
    for (const extension of entryFile.extensions) {
      uniqExtensions.add(extension);
    }
  }

  config.extensions = Array.from(uniqExtensions);
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

export async function writeConfig(config: Partial<Config>) {
  const current = await readJson(CONFIG_FILE);
  const next = Object.assign({}, current, config);
  return await writeJson(CONFIG_FILE, next);
}

export async function updateAllowLists(
  files: ProcessedResult,
  context: Context,
) {
  const cfg = context.config;

  await writeConfig({
    ignoreUnresolved: merge(cfg.ignoreUnresolved, files.unresolved),
    ignoreUnused: merge(cfg.ignoreUnused, files.unused),
    ignoreUnimported: merge(cfg.ignoreUnimported, files.unimported),
  });
}

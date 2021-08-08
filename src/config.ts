import { ProcessedResult } from './process';
import { readJson, writeJson } from './fs';
import { CliArguments, Context, PackageJson } from './index';
import glob from 'glob';
import { promisify } from 'util';
import { ensureArray } from './ensureArray';
import { MapLike } from 'typescript';
import { hasPackage } from './meta';
import { presets } from './presets';
import readPkgUp from 'read-pkg-up';

const globAsync = promisify(glob);

const CONFIG_FILE = '.unimportedrc.json';

export interface EntryConfig {
  file: string;
  label?: string;
  aliases: MapLike<string[]>;
  extensions: string[];
}

export interface UnimportedConfig {
  preset?: string;
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

type PresetParams = {
  packageJson: PackageJson;
  hasPackage: (name: string) => boolean;
};

export type Preset = {
  name: string;
  isMatch: (options: PresetParams) => Promise<boolean> | boolean;
  getConfig: (
    options: PresetParams,
  ) => Promise<UnimportedConfig> | UnimportedConfig;
};

export interface Config {
  version: string;
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

export async function getPreset(
  name?: string,
): Promise<UnimportedConfig | undefined> {
  const packageJson =
    (await readJson<PackageJson>('package.json')) || ({} as PackageJson);

  const options = {
    packageJson,
    hasPackage: (name: string) => hasPackage(packageJson, name),
  };

  const preset = presets.find(
    (preset) => preset.name === name || preset.isMatch(options),
  );

  if (!preset) {
    return;
  }

  const config = await preset.getConfig(options);

  return {
    preset: preset.name,
    ...config,
  };
}

export async function getConfig(args?: CliArguments): Promise<Config> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configFile = await readJson<Partial<UnimportedConfig>>(CONFIG_FILE);
  const unimportedPkg = await readPkgUp({ cwd: __dirname });

  const preset = await getPreset(configFile?.preset);

  const config: Config = {
    version: unimportedPkg?.packageJson.version || 'unknown',
    preset: preset?.preset,
    flow: args?.flow ?? configFile?.flow ?? preset?.flow ?? false,
    rootDir: configFile?.rootDir ?? preset?.rootDir,
    ignoreUnresolved:
      configFile?.ignoreUnresolved ?? preset?.ignoreUnresolved ?? [],
    ignoreUnimported: await expandGlob(
      configFile?.ignoreUnimported ?? preset?.ignoreUnimported ?? [],
    ),
    ignoreUnused: configFile?.ignoreUnused ?? preset?.ignoreUnused ?? [],
    ignorePatterns: configFile?.ignorePatterns ?? preset?.ignorePatterns ?? [],
    entryFiles: [],
    extensions: [],
  };

  const aliases = configFile?.aliases ?? preset?.aliases ?? {};
  const extensions = configFile?.extensions ?? preset?.extensions ?? [];
  const entryFiles = configFile?.entry ?? preset?.entry ?? [];

  // throw if no entry point could be found
  if (entryFiles.length === 0) {
    throw new Error(
      `Unable to locate entry points for this ${
        preset?.preset ?? ''
      } project. Please declare them in package.json or .unimportedrc.json`,
    );
  }

  for (const entry of entryFiles) {
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

  // collect _all_ extensions for file listing
  const uniqExtensions = new Set(extensions);
  for (const entryFile of config.entryFiles) {
    for (const extension of entryFile.extensions) {
      // pop the last part, so that .server.js merges with .js
      uniqExtensions.add('.' + extension.split('.').pop());
    }
  }

  config.extensions = Array.from(uniqExtensions);

  cachedConfig = config;
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

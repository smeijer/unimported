import * as fs from './fs';
import path, { join } from 'path';
import { MapLike } from 'typescript';
import { ensureArray } from './ensureArray';
import { Context, JsConfig, PackageJson, TsConfig } from './index';
import { EntryConfig, getConfig } from './config';
import { log } from './log';

interface Aliases {
  [index: string]: string[];
}

export function hasPackage(packageJson: PackageJson, name: string): boolean {
  return Boolean(
    packageJson.dependencies?.[name] ||
      packageJson.devDependencies?.[name] ||
      packageJson.peerDependencies?.[name],
  );
}

export function typedBoolean<T>(
  value: T,
): value is Exclude<T, false | null | undefined | '' | 0> {
  return Boolean(value);
}

export async function getAliases(
  entryFile: EntryConfig,
): Promise<MapLike<string[]>> {
  const [packageJson, tsconfig, jsconfig] = await Promise.all([
    fs.readJson<PackageJson>('package.json'),
    fs.readJson<TsConfig>('tsconfig.json'),
    fs.readJson<JsConfig>('jsconfig.json'),
  ]);

  const config = await getConfig();

  let aliases: Aliases = {};

  let baseUrl =
    config?.rootDir ??
    tsconfig?.compilerOptions?.baseUrl ??
    jsconfig?.compilerOptions?.baseUrl ??
    '.';

  // '/' doesn't resolve
  if (baseUrl === '/') {
    baseUrl = '.';
  }

  const root = path.resolve(baseUrl);

  // add support for root slash import
  aliases['/'] = [`${root}/`];

  // add support for mono-repos
  if (packageJson?.repository?.directory) {
    const root = path.resolve('../');
    const packages = await fs.list('*/', root, { realpath: false });
    for (const alias of packages) {
      aliases[alias] = [join(root, alias)];
    }
  }

  // add support for typescript path aliases
  if (tsconfig?.compilerOptions?.paths) {
    const root = path.resolve(tsconfig.compilerOptions.baseUrl || '.');
    aliases = Object.assign(
      aliases,
      normalizeAliases(root, tsconfig.compilerOptions.paths),
    );
  }

  // add support for jsconfig path aliases
  if (jsconfig?.compilerOptions?.paths) {
    const root = path.resolve(jsconfig.compilerOptions.baseUrl || '.');
    aliases = Object.assign(
      aliases,
      normalizeAliases(root, jsconfig.compilerOptions.paths),
    );
  }

  // add support for additional path aliases (in typescript compiler path like setup)
  if (entryFile.aliases) {
    aliases = Object.assign(aliases, normalizeAliases(root, entryFile.aliases));
  }

  log.info(`aliases for %s %O`, entryFile ?? '*', aliases);
  return aliases;
}

// normalize the aliases. The keys maintain trailing '/' to ease path comparison,
// in: { '@components/*': ['src/components/*'] }
// out: { '@components/': ['src/components/'] }
function normalizeAliases(root: string, paths: MapLike<string[]>): Aliases {
  const aliases: Aliases = {};

  for (const key of Object.keys(paths)) {
    const alias = key.replace(/\*$/, '');

    aliases[alias] = ensureArray(paths[key]).map((x) => {
      const path = join(root, x.replace(/\*$/, ''));
      return alias.endsWith('/') && !path.endsWith('/') ? `${path}/` : path;
    });

    // only keep uniqs
    aliases[alias] = Array.from(new Set(aliases[alias]));
  }

  return aliases;
}

export async function getDependencies(
  projectPath: string,
): Promise<Context['dependencies']> {
  const packageJson = await fs.readJson<PackageJson>(
    'package.json',
    projectPath,
  );

  if (!packageJson) {
    return {};
  }

  return packageJson!.dependencies || {};
}

export async function getPeerDependencies(
  projectPath: string,
): Promise<Context['peerDependencies']> {
  const packageJson = await fs.readJson<PackageJson>(
    'package.json',
    projectPath,
  );

  if (!packageJson) {
    return {};
  }

  const peerDependencies = {};

  for (const dep of Object.keys(packageJson.dependencies || {})) {
    const json = await fs.readJson<PackageJson>(
      join('node_modules', dep, 'package.json'),
      projectPath,
    );
    Object.assign(peerDependencies, json?.peerDependencies);
  }

  return peerDependencies;
}

import * as fs from './fs';
import path, { join } from 'path';
import { MapLike } from 'typescript';
import { ensureArray } from './ensureArray';
import { Context, JsConfig, PackageJson, TsConfig } from './index';
import { EntryConfig, expandGlob, getConfig } from './config';
import { log } from './log';
import resolve from 'resolve';

interface Aliases {
  [index: string]: string[];
}

export async function getProjectType(): Promise<string> {
  if (await fs.exists('.next')) {
    return 'next';
  }

  if (await fs.exists('.meteor')) {
    return 'meteor';
  }

  return 'node';
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

  return packageJson.dependencies || {};
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

/**
 * Return relative paths to resolved entry files
 */
export async function findEntryFiles(
  preset: string,
  extensions: string[],
): Promise<string[]> {
  const packageJson = await fs.readJson<PackageJson>('package.json');

  if (!packageJson) {
    throw new Error('could not load package.json');
  }

  if (preset === 'next') {
    const pages = await expandGlob('./pages/**/*.{js,jsx,ts,tsx}');
    return pages.map((page) => page);
  }

  if (preset === 'meteor') {
    const mainModule = packageJson.meteor?.mainModule;

    if (!mainModule) {
      throw new Error(
        'Meteor projects are only supported if the mainModule is defined in package.json',
      );
    }

    return [mainModule.client, mainModule.server];
  }

  const { source, main } = packageJson;
  const options = [
    source,
    './src/index',
    './src/main',
    './index',
    './main',
    main,
  ].filter(Boolean) as string[];

  const [entry] = options
    .map((x) => {
      try {
        return resolve
          .sync(x, {
            basedir: process.cwd(),
            extensions,
          })
          .replace(/\\/g, '/');
      } catch {}
    })
    .filter(Boolean);

  if (entry) {
    return [path.relative(process.cwd(), entry)];
  }

  throw new Error('could not find entry point');
}

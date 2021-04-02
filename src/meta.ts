import * as fs from './fs';
import { join } from 'path';
import { MapLike } from 'typescript';
import { ensureArray } from './ensureArray';
import { Context, PackageJson, TsConfig } from './index';
import { resolveImport } from './traverse';
import { expandGlob, getConfig } from './config';

interface Aliases {
  [index: string]: string[];
}

export async function getProjectType(
  projectPath: string,
): Promise<Context['type']> {
  if (await fs.exists('.next', projectPath)) {
    return 'next';
  }

  if (await fs.exists('.meteor', projectPath)) {
    return 'meteor';
  }

  return 'node';
}

export async function getAliases(
  projectPath: string,
): Promise<Context['aliases']> {
  const [packageJson, tsconfig] = await Promise.all([
    fs.readJson<PackageJson>('package.json', projectPath),
    fs.readJson<TsConfig>('tsconfig.json', projectPath),
  ]);

  const config = await getConfig();

  let aliases: Aliases = {};

  // add support for (meteor) root slash import
  aliases['/'] = [`${projectPath}/`];

  // add support for mono-repos
  if (packageJson?.repository?.directory) {
    const root = join(projectPath, '../');
    const packages = await fs.list('*/', root, { realpath: false });
    for (const alias of packages) {
      aliases[alias] = [join(root, alias)];
    }
  }

  // add support for typescript path aliases
  if (tsconfig?.compilerOptions?.paths) {
    const paths = tsconfig.compilerOptions.paths;
    const root = join(projectPath, tsconfig.compilerOptions.rootDir || '.');
    aliases = Object.assign(aliases, normalizeAliases(root, paths));
  }

  // add support for additional path aliases (in typescript compiler path
  // like setup)
  if (config?.aliases) {
    const paths = config.aliases;
    const root = join(projectPath, config?.rootDir || '.');
    aliases = Object.assign(aliases, normalizeAliases(root, paths));
  }

  return aliases;
}

// normalize the aliases. The keys maintain trailing '/' to ease path comparison,
// in: { '@components/*': ['src/components/*'] }
// out: { '@components/': ['src/components/'] }
function normalizeAliases(root: string, paths: MapLike<string[]>): Aliases {
  const aliases: Aliases = {};

  for (const key of Object.keys(paths)) {
    const alias = key.replace(/\*$/, '');
    aliases[alias] = ensureArray(paths[key]).map((x) =>
      join(root, x.replace(/\*$/, '')),
    );
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

function isString(value): value is string {
  return typeof value === 'string';
}

export async function getEntry(
  projectPath: string,
  context: Context,
): Promise<string[]> {
  const config = await getConfig();

  if (config.entry) {
    return ensureArray(config.entry).map(
      (entry) => resolveImport(entry, projectPath, context).path,
    );
  }

  const packageJson = await fs.readJson<PackageJson>(
    'package.json',
    projectPath,
  );

  if (!packageJson) {
    throw new Error('could not load package.json');
  }

  if (context.type === 'next') {
    const pages = await expandGlob('./pages/**/*.{js,jsx,ts,tsx}');
    return pages.map((path) => resolveImport(path, projectPath, context).path);
  }

  if (context.type === 'meteor') {
    if (!packageJson.meteor?.mainModule) {
      throw new Error(
        'Meteor projects are only supported if the mainModule is defined in package.json',
      );
    }

    const client = resolveImport(
      packageJson.meteor.mainModule.client,
      projectPath,
      context,
    );

    const server = resolveImport(
      packageJson.meteor.mainModule.server,
      projectPath,
      context,
    );

    return [
      client.type !== 'unresolved' && client.path,
      server.type !== 'unresolved' && server.path,
    ].filter(isString);
  }

  const { source, main } = packageJson;
  const options = [
    source,
    './src/index',
    './src/main',
    './index',
    './main',
    main,
  ];

  const resolved = await Promise.all(
    options.map((x) => resolveImport(`${x}`, projectPath, context)),
  );

  const entry = resolved.find((x) => x.type === 'source_file');
  if (entry) {
    return [entry.path];
  }

  throw new Error('could not find entry point');
}

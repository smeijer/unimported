import * as fs from './fs';
import { join } from 'path';
import { ensureArray } from './ensureArray';
import { Context } from './index';
import { resolveImport } from './traverse';

export async function getProjectType(
  projectPath: string,
): Promise<Context['type']> {
  if (await fs.exists('.meteor', projectPath)) {
    return 'meteor';
  }

  return 'node';
}

export async function getAliases(
  projectPath: string,
): Promise<Context['aliases']> {
  const tsconfig = await fs.readJson('tsconfig.json', projectPath);

  if (!tsconfig) {
    // add support for (meteor) root slash import
    return {
      '/': [`${projectPath}/`],
    };
  }

  const aliases = tsconfig.compilerOptions?.paths || {};
  const root = join(projectPath, tsconfig.compilerOptions?.rootDir || '.');

  // normalize the aliases. The keys maintain trailing '/' to ease path comparison,
  // in: { '@components/*': ['src/components/*'] }
  // out: { '@components/': ['src/components/'] }
  for (const key of Object.keys(aliases)) {
    const alias = key.replace(/\*$/, '');
    aliases[alias] = ensureArray(aliases[key]).map((x) =>
      join(root, x.replace(/\*$/, '')),
    );
    delete aliases[key];
  }

  // add support for (meteor) root slash import
  if (!aliases['/']) {
    aliases['/'] = [`${projectPath}/`];
  }

  return aliases;
}

export async function getDependencies(
  projectPath: string,
): Promise<Context['dependencies']> {
  const packageJson = await fs.readJson('package.json', projectPath);

  if (!packageJson) {
    return {};
  }

  return packageJson.dependencies || {};
}

function isString(value): value is string {
  return typeof value === 'string';
}

export async function getEntry(
  projectPath: string,
  context: Context,
): Promise<string[]> {
  const packageJson = await fs.readJson('package.json', projectPath);

  if (context.type === 'meteor') {
    if (!packageJson.meteor?.mainModule) {
      throw new Error(
        'Meteor projects are only supported if the mainModule is defined in package.json',
      );
    }

    const client = await resolveImport(
      packageJson.meteor.mainModule.client,
      projectPath,
      context,
    );
    const server = await resolveImport(
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

import * as fs from './fs';
import { join } from 'path';
import { ensureArray } from './ensureArray';
import { Context } from './index';

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
    return {};
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

    return [
      packageJson.meteor.mainModule.client,
      packageJson.meteor.mainModule.server,
    ]
      .filter(Boolean)
      .map((x) => join(projectPath, x));
  }

  const commonOptions = ['src/index', 'src/main', 'index', 'main']
    .map((x) => context.extensions.map((ext) => `${x}${ext}`))
    .reduce((acc, next) => {
      acc.push(...next);
      return acc;
    }, [])
    .map((x) => join(projectPath, x));

  const options = [
    join(projectPath, `${packageJson.source}`),
    ...commonOptions,
    join(projectPath, `${packageJson.main}`),
  ];

  for (const option of options) {
    if (await fs.exists(option)) {
      return [option];
    }
  }

  throw new Error('could not find entry point');
}

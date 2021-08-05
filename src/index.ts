import simpleGit from 'simple-git';

import * as fs from './fs';
import readPkgUp from 'read-pkg-up';

import path, { join } from 'path';
import ora from 'ora';
import { printResults } from './print';
import * as meta from './meta';
import { traverse } from './traverse';
import chalk from 'chalk';
import { readJson } from './fs';
import yargs, { Arguments } from 'yargs';
import { CompilerOptions } from 'typescript';
import { processResults } from './process';
import {
  getConfig,
  UnimportedConfig,
  updateAllowLists,
  writeConfig,
} from './config';
import { InvalidCacheError, purgeCache, storeCache } from './cache';

export interface TsConfig {
  compilerOptions: CompilerOptions;
}

export interface JsConfig {
  compilerOptions: CompilerOptions;
}

export interface PackageJson {
  name: string;
  version: string;
  main?: string;
  source?: string;
  dependencies?: { [name: string]: string };
  optionalDependencies?: { [name: string]: string };
  devDependencies?: { [name: string]: string };
  bundleDependencies?: { [name: string]: string };
  peerDependencies?: { [name: string]: string };
  meteor?: {
    mainModule?: {
      client: string;
      server: string;
    };
  };
  repository?: {
    directory: string;
  };
}

export interface Context {
  version: string;
  cwd: string;
  entry: string[];
  aliases: { [key: string]: string[] };
  ignore: string[];
  extensions: string[];
  dependencies: { [key: string]: string };
  peerDependencies: { [key: string]: string };
  type: 'meteor' | 'next' | 'node';
  flow?: boolean;
  cache?: boolean;
  config: UnimportedConfig;
  moduleDirectory: string[];
}

export async function main(args: CliArguments): Promise<void> {
  const spinner = ora(
    process.env.NODE_ENV === 'test' ? '' : 'initializing',
  ).start();
  const pkg = await readPkgUp({ cwd: args.cwd });

  if (!pkg) {
    spinner.stop();
    console.error(
      chalk.redBright(
        `could not resolve package.json, are you in a node project?`,
      ),
    );
    process.exit(1);
    return;
  }

  // change the work dir for the process to the project root, this enables us
  // to run unimported from nested paths within the project
  process.chdir(path.dirname(pkg.path));
  const cwd = process.cwd();

  try {
    const config = await getConfig();
    args.flow = config.flow ?? args.flow;

    const [aliases, dependencies, peerDependencies, type] = await Promise.all([
      meta.getAliases(cwd),
      meta.getDependencies(cwd),
      meta.getPeerDependencies(cwd),
      meta.getProjectType(cwd),
    ]);

    const packageJson = await readJson<PackageJson>('./package.json', cwd);

    if (!packageJson) {
      throw new Error('Failed to load package.json');
    }

    const moduleDirectory = config.moduleDirectory ?? ['node_modules'];

    const context: Context = {
      version: packageJson.version,
      aliases,
      dependencies,
      peerDependencies,
      type,
      extensions: config.extensions || ['.js', '.jsx', '.ts', '.tsx'],
      ignore: [],
      entry: [],
      config,
      moduleDirectory,
      ...args,
      cwd,
    };

    context.ignore =
      config.ignorePatterns ||
      ([
        '**/node_modules/**',
        '**/*.stories.{js,jsx,ts,tsx}',
        '**/*.tests.{js,jsx,ts,tsx}',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/tests/**',
        '**/__tests__/**',
        '**/*.d.ts',
        ...(context.type === 'meteor'
          ? ['packages/**', 'public/**', 'private/**', 'tests/**']
          : []),
      ].filter(Boolean) as string[]);

    if (args.init) {
      await writeConfig({ ignorePatterns: context.ignore }, context);
      spinner.stop();
      process.exit(0);
    }

    // Filter untracked files from git repositories
    if (args.ignoreUntracked) {
      // Filter
      const git = simpleGit({ baseDir: context.cwd });
      const status = await git.status();
      context.ignore = [
        ...context.ignore,
        ...status.not_added.map((notAdded) => `${cwd}/${notAdded}`),
      ];
    }

    // traverse all source files and get import data
    context.entry = await meta.getEntry(cwd, context);

    spinner.text = `resolving imports`;
    let traverseResult;
    try {
      traverseResult = await traverse(context.entry, context);
    } catch (err) {
      // Retry once after invalid cache case.
      if (err instanceof InvalidCacheError) {
        purgeCache();
        traverseResult = await traverse(context.entry, context);
      } else {
        throw err;
      }
    }
    traverseResult.files = new Map([...traverseResult.files].sort());

    // traverse the file system and get system data
    spinner.text = 'traverse the file system';
    const baseUrl = (await fs.exists('src', cwd)) ? join(cwd, 'src') : cwd;
    const files = await fs.list('**/*', baseUrl, {
      extensions: context.extensions,
      ignore: context.ignore,
    });

    const normalizedFiles = files.map((path) => path.replace(/\\/g, '/'));

    spinner.text = 'process results';
    spinner.stop();

    const result = await processResults(
      normalizedFiles,
      traverseResult,
      context,
    );

    if (args.cache) {
      storeCache();
    }

    if (args.update) {
      await updateAllowLists(result, context);
      // doesn't make sense here to return a error code
      process.exit(0);
    } else {
      printResults(result, context);
    }

    // return non-zero exit code in case the result wasn't clean, to support
    // running in CI environments.
    if (!result.clean) {
      process.exit(1);
    }
  } catch (error) {
    spinner.stop();
    console.error(
      chalk.redBright(
        error.path
          ? `\nFailed parsing ${error.path}`
          : 'something unexpected happened',
      ),
    );
    console.error(error);
    process.exit(1);
  }
}

export interface CliArguments {
  flow: boolean;
  update: boolean;
  init: boolean;
  ignoreUntracked: boolean;
  clearCache: boolean;
  cache: boolean;
  cwd?: string;
}

if (process.env.NODE_ENV !== 'test') {
  /* istanbul ignore next */
  yargs
    .scriptName('unimported')
    .usage('$0 <cmd> [args]')
    .command(
      '* [cwd]',
      'scan your project for dead files',
      (yargs) => {
        yargs.positional('cwd', {
          type: 'string',
          describe: 'The root directory that unimported should run from.',
        });

        yargs.option('cache', {
          type: 'boolean',
          describe:
            'Whether to use the cache. Disable the cache using --no-cache.',
          default: true,
        });

        yargs.option('clear-cache', {
          type: 'boolean',
          describe: 'Clears the cache file and then exits.',
        });

        yargs.option('flow', {
          alias: 'f',
          type: 'boolean',
          describe: 'Whether to strip flow types, regardless of @flow pragma.',
        });

        yargs.option('ignore-untracked', {
          type: 'boolean',
          describe: 'Ignore files that are not currently tracked by git.',
        });

        yargs.option('init', {
          alias: 'i',
          type: 'boolean',
          describe: 'Dump default settings to .unimportedrc.json.',
        });

        yargs.option('update', {
          alias: 'u',
          type: 'boolean',
          describe: 'Update the ignore-lists stored in .unimportedrc.json.',
        });
      },
      function (argv: Arguments<CliArguments>) {
        if (argv.clearCache) {
          return purgeCache();
        }

        return main({
          init: argv.init,
          update: argv.update,
          flow: argv.flow,
          ignoreUntracked: argv.ignoreUntracked,
          clearCache: argv.clearCache,
          cache: argv.cache,
          cwd: argv.cwd,
        });
      },
    )
    .help().argv;
}

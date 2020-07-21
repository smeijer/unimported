import * as fs from './fs';

import { join } from 'path';
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

export interface TsConfig {
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
  type: 'meteor' | 'node';
  flow?: boolean;
  config: UnimportedConfig;
}

async function main(args: CliArguments) {
  const spinner = ora('initializing').start();
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

    const packageJson = await readJson<PackageJson>(
      '../package.json',
      __dirname,
    );

    if (!packageJson) {
      throw new Error('Failed to load package.json');
    }

    const context: Context = {
      version: packageJson.version,
      cwd,
      aliases,
      dependencies,
      peerDependencies,
      type,
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      ignore: [],
      entry: [],
      config,
      ...args,
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

    // traverse all source files and get import data
    context.entry = await meta.getEntry(cwd, context);
    spinner.text = `resolving imports`;
    const traverseResult = await traverse(context.entry, context);
    traverseResult.files = new Map([...traverseResult.files].sort());

    // traverse the file system and get system data
    spinner.text = 'traverse the file system';
    const baseUrl = (await fs.exists('src', cwd)) ? join(cwd, 'src') : cwd;
    const files = await fs.list('**/*', baseUrl, {
      extensions: context.extensions,
      ignore: context.ignore,
    });

    spinner.text = 'process results';
    spinner.stop();

    const result = await processResults(files, traverseResult, context);

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
    console.error(chalk.redBright('something unexpected happened'));
    console.error(error);
    process.exit(1);
  }
}

interface CliArguments {
  flow: boolean;
  update: boolean;
  init: boolean;
}

yargs
  .scriptName('unimported')
  .usage('$0 <cmd> [args]')
  .command(
    '*',
    'scan your project for dead files',
    (yargs) => {
      yargs.option('init', {
        alias: 'i',
        type: 'boolean',
        describe: 'dump default settings to .unimportedrc.json',
      });

      yargs.option('flow', {
        alias: 'f',
        type: 'boolean',
        describe: 'indicates if your code is annotated with flow types',
      });

      yargs.option('update', {
        alias: 'u',
        type: 'boolean',
        describe: 'update the ignore-lists stored in .unimportedrc.json',
      });
    },
    function (argv: Arguments<CliArguments>) {
      return main({
        init: argv.init,
        update: argv.update,
        flow: argv.flow,
      });
    },
  )
  .help().argv;

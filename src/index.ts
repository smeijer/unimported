import * as fs from './fs';

import { join } from 'path';
import ora from 'ora';
import { printResults } from './print';
import * as meta from './meta';
import { traverse } from './traverse';
import chalk from 'chalk';
import { readJson } from './fs';
import yargs, { Arguments } from 'yargs';

export interface Context {
  version: string;
  cwd: string;
  entry: string[];
  aliases: { [key: string]: string[] };
  ignore: string[];
  extensions: string[];
  dependencies: { [key: string]: string };
  type: 'meteor' | 'node';
  flow?: boolean;
}

async function main(args: Partial<Context>) {
  const spinner = ora('initializing').start();
  const cwd = process.cwd();

  try {
    const [aliases, dependencies, type] = await Promise.all([
      meta.getAliases(cwd),
      meta.getDependencies(cwd),
      meta.getProjectType(cwd),
    ]);

    const packageJson = await readJson('../package.json', __dirname);

    const context: Context = {
      version: packageJson.version,
      cwd,
      aliases,
      dependencies,
      type,
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      ignore: [],
      entry: [],
      ...args,
    };

    context.ignore = [
      '**/node_modules/**',
      '**/*.stories.{js,jsx,ts,tsx}',
      '**/*.tests.{js,jsx,ts,tsx}',
      '**/*.spec.{js,jsx,ts,tsx}',
      '**/tests/**',
      '**/__tests__/**',
      '**/*.d.ts',
      context.type === 'meteor' && 'packages/**',
    ].filter(Boolean) as string[];

    if (context.type === 'meteor') {
      context.ignore.push('public/**', 'private/**', 'tests/**');
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
    printResults(files, traverseResult, context);
  } catch (error) {
    spinner.stop();
    console.error(chalk.redBright('something unexpected happened'));
    console.error(error);
    process.exit(0);
  }
}

interface CliArguments {
  flow: boolean;
}

yargs
  .scriptName('unimported')
  .usage('$0 <cmd> [args]')
  .command(
    '*',
    'scan your project for dead files',
    (yargs) => {
      yargs.option('flow', {
        alias: 'f',
        type: 'boolean',
        default: false,
        describe: 'indicates if your code is annotated with flow types',
      });
    },
    function (argv: Arguments<CliArguments>) {
      return main({ flow: argv.flow });
    },
  )
  .help().argv;

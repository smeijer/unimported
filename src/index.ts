import simpleGit from 'simple-git';

import * as fs from './fs';
import readPkgUp from 'read-pkg-up';

import path, { join } from 'path';
import ora from 'ora';
import { printResults } from './print';
import * as meta from './meta';
import { getResultObject, traverse, TraverseConfig } from './traverse';
import chalk from 'chalk';
import yargs, { Arguments } from 'yargs';
import { CompilerOptions } from 'typescript';
import { processResults } from './process';
import {
  getConfig,
  Config,
  updateAllowLists,
  writeConfig,
  getPreset,
} from './config';
import {
  getCacheIdentity,
  InvalidCacheError,
  purgeCache,
  storeCache,
} from './cache';
import { log } from './log';
import { presets } from './presets';

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
  cwd: string;
  dependencies: { [key: string]: string };
  peerDependencies: { [key: string]: string };
  cache?: boolean;
  config: Config;
  moduleDirectory: string[];
  cacheId?: string;
}

const oraStub = {
  set text(msg) {
    log.info(msg);
  },
  stop(msg = '') {
    log.info(msg);
  },
};

export async function main(args: CliArguments): Promise<void> {
  const projectPkg = await readPkgUp({ cwd: args.cwd });
  const unimportedPkg = await readPkgUp({ cwd: __dirname });

  // equality check to prevent tests from walking up and running on unimported itself
  if (!projectPkg || !unimportedPkg || unimportedPkg.path === projectPkg.path) {
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
  process.chdir(path.dirname(projectPkg.path));
  const cwd = process.cwd();

  // clear cache and return
  if (args.clearCache) {
    return purgeCache();
  }

  const spinner =
    log.enabled() || process.env.NODE_ENV === 'test'
      ? oraStub
      : ora('initializing').start();

  try {
    const config = await getConfig(args);

    if (args.showConfig) {
      spinner.stop();
      console.dir(config, { depth: 5 });
      process.exit(0);
    }

    if (typeof args.showPreset === 'string') {
      spinner.stop();
      if (args.showPreset) {
        console.dir(await getPreset(args.showPreset), { depth: 5 });
      } else {
        const available = presets
          .map((x) => x.name)
          .sort()
          .map((x) => `  - ${x}`)
          .join('\n');

        console.log(
          `you didn't provide a preset name, please choose one of the following: \n\n${available}`,
        );
      }
      process.exit(0);
    }

    const [dependencies, peerDependencies] = await Promise.all([
      meta.getDependencies(cwd),
      meta.getPeerDependencies(cwd),
    ]);

    const moduleDirectory = config.moduleDirectory ?? ['node_modules'];

    const context: Context = {
      dependencies,
      peerDependencies,
      config,
      moduleDirectory,
      ...args,
      cwd,
    };

    if (args.init) {
      await writeConfig({
        ignorePatterns: config.ignorePatterns,
        ignoreUnimported: config.ignoreUnimported,
        ignoreUnused: config.ignoreUnused,
        ignoreUnresolved: config.ignoreUnresolved,
      });

      spinner.stop();
      process.exit(0);
    }

    // Filter untracked files from git repositories
    if (args.ignoreUntracked) {
      const git = simpleGit({ baseDir: context.cwd });
      const status = await git.status();
      config.ignorePatterns.push(
        ...status.not_added.map((file) => path.resolve(file)),
      );
    }

    spinner.text = `resolving imports`;

    const traverseResult = getResultObject();

    for (const entry of config.entryFiles) {
      log.info('start traversal at %s', entry);

      const traverseConfig: TraverseConfig = {
        extensions: entry.extensions,
        // resolve full path of aliases
        aliases: await meta.getAliases(entry),
        cacheId: args.cache ? getCacheIdentity(entry) : undefined,
        flow: config.flow,
        moduleDirectory,
        preset: config.preset,
        dependencies,
      };

      // we can't use the third argument here, to keep feeding to traverseResult
      // as that would break the import alias overrides. A client-entry file
      // can resolve `create-api` as `create-api-client.js` while server-entry
      // would resolve `create-api` to `create-api-server`. Sharing the subresult
      // between the initial and retry attempt, would make it fail cache recovery
      const subResult = await traverse(
        path.resolve(entry.file),
        traverseConfig,
      ).catch((err) => {
        if (err instanceof InvalidCacheError) {
          purgeCache();
          // Retry once after invalid cache case.
          return traverse(path.resolve(entry.file), traverseConfig);
        } else {
          throw err;
        }
      });

      subResult.files = new Map([...subResult.files].sort());

      // and that's why we need to merge manually
      subResult.modules.forEach((module) => {
        traverseResult.modules.add(module);
      });
      subResult.unresolved.forEach((unresolved) => {
        traverseResult.unresolved.add(unresolved);
      });

      for (const [key, stat] of subResult.files) {
        const prev = traverseResult.files.get(key);

        if (!prev) {
          traverseResult.files.set(key, stat);
          continue;
        }

        const added = new Set(prev.imports.map((x) => x.path));

        for (const file of stat.imports) {
          if (!added.has(file.path)) {
            prev.imports.push(file);
            added.add(file.path);
          }
        }
      }
    }

    // traverse the file system and get system data
    spinner.text = 'traverse the file system';
    const baseUrl = (await fs.exists('src', cwd)) ? join(cwd, 'src') : cwd;
    const files = await fs.list('**/*', baseUrl, {
      extensions: config.extensions,
      ignore: config.ignorePatterns,
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
    // console.log is intercepted for output comparison, this helps debugging
    if (process.env.NODE_ENV === 'test') {
      console.log(error.message);
    }

    spinner.stop();
    console.error(
      chalk.redBright(
        error.path ? `\nFailed parsing ${error.path}` : error.message,
      ),
    );
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
  showConfig: boolean;
  showPreset?: string;
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

        yargs.option('show-config', {
          type: 'boolean',
          describe: 'Show config and then exists.',
        });

        yargs.option('show-preset', {
          type: 'string',
          describe: 'Show preset and then exists.',
        });

        yargs.option('update', {
          alias: 'u',
          type: 'boolean',
          describe: 'Update the ignore-lists stored in .unimportedrc.json.',
        });
      },
      function (argv: Arguments<CliArguments>) {
        return main(argv);
      },
    )
    .help().argv;
}

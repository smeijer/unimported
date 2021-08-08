import fs from 'fs';
import { join, relative } from 'path';
import glob, { IOptions as GlobOptions } from 'glob';
import util from 'util';
import json5 from 'json5';
import { typedBoolean } from './meta';
import resolve from 'resolve';

const globAsync = util.promisify(glob);
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);
const existsAsync = util.promisify(fs.exists);

export async function exists(path: string, cwd = ''): Promise<boolean> {
  return await existsAsync(join(cwd, path));
}

export async function readText(path: string, cwd = ''): Promise<string> {
  try {
    return await readFileAsync(join(cwd, path), { encoding: 'utf8' });
  } catch (e) {
    return '';
  }
}

export async function writeText(
  path: string,
  data: string,
  cwd = '',
): Promise<void> {
  try {
    return await writeFileAsync(join(cwd, path), data, { encoding: 'utf8' });
  } catch (e) {
    return;
  }
}

export async function readJson<T extends any>(
  path: string,
  cwd = '.',
): Promise<T | undefined> {
  try {
    const text = await readText(path, cwd);
    return text ? json5.parse(text) : undefined;
  } catch (e) {
    console.error('\nfile does not contain valid json:', path, 'error: ', e);
    return undefined;
  }
}

export async function writeJson(
  path: string,
  data: Record<string, any>,
  cwd = '.',
): Promise<void> {
  const text = JSON.stringify(data, null, '  ');
  return await writeText(path, text, cwd);
}

type ListOptions = GlobOptions & {
  extensions?: string[];
};

export async function list(
  pattern: string,
  cwd: string,
  options: ListOptions = {},
): Promise<string[]> {
  const { extensions, ...globOptions } = options;

  // transform:
  // - ['.js', '.tsx'] to **/*.{js,tsx}
  // -['.js'] to **/*.js
  const normalizedExtensions = extensions?.map((x) => x.replace(/^\./, ''));
  const wrappedExtensions =
    extensions?.length === 1
      ? normalizedExtensions
      : `{${normalizedExtensions}}`;

  const fullPattern = Array.isArray(extensions)
    ? `${pattern}.${wrappedExtensions}`
    : pattern;

  return await globAsync(fullPattern, {
    cwd,
    realpath: true,
    ...globOptions,
  });
}

export function resolveFilesSync(
  options: Array<string | undefined>,
  extensions: string[],
): Array<string | undefined> {
  const basedir = process.cwd();

  return options
    .map((file) => {
      try {
        if (!file) {
          return;
        }

        file = file.startsWith('./') ? file : `./${file}`;

        return (
          file &&
          resolve
            .sync(file, {
              basedir,
              extensions,
            })
            .replace(/\\/g, '/')
        );
      } catch {}
    })
    .map((file) => file && relative(basedir, file));
}

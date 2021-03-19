import fs from 'fs';
import { join } from 'path';
import glob, { IOptions as GlobOptions } from 'glob';
import util from 'util';

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
): Promise<T | null> {
  try {
    const text = await readText(path, cwd);
    return text ? JSON.parse(text) : null;
  } catch (e) {
    console.error('\nfile does not contain valid json:', path, 'error: ', e);
    return null;
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

  // transform ['.js', '.tsx'] to **/*.{js,tsx}
  const fullPattern = Array.isArray(extensions)
    ? `${pattern}.{${extensions.map((x) => x.replace(/^\./, '')).join(',')}}`
    : pattern;

  return await globAsync(fullPattern, {
    cwd,
    realpath: true,
    ...globOptions,
  });
}

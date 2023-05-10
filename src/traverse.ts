import { dirname, extname, relative } from 'path';

import {
  AST_NODE_TYPES,
  parse as parseEstree,
  simpleTraverse,
} from '@typescript-eslint/typescript-estree';
import * as fs from './fs';
import type {
  Identifier,
  Literal,
} from '@typescript-eslint/types/dist/generated/ast-spec';
import resolve from 'resolve';
import removeFlowTypes from 'flow-remove-types';
import {
  invalidateEntries,
  invalidateEntry,
  InvalidCacheError,
  resolveEntry,
} from './cache';
import { log } from './log';
import { MapLike } from 'typescript';

export interface FileStats {
  path: string;
  extname: string;
  dirname: string;
  imports: ResolvedResult[];
}

export interface TraverseResult {
  unresolved: Map<string, string[]>;
  files: Map<string, FileStats>;
  modules: Set<string>;
}

function getDependencyName(
  path: string,
  config: TraverseConfig,
): string | null {
  if (config.preset === 'meteor' && path.startsWith('meteor/')) {
    return path;
  }

  const [namespace, module] = path.split('/');
  const name = path[0] === '@' ? `${namespace}/${module}` : namespace;

  if (config.dependencies[name]) {
    return name;
  }

  if (config.dependencies[`@types/${name}`]) {
    return `@types/${name}`;
  }

  return null;
}

function transformPath(rawPath: string, config: TraverseConfig): string {
  let path = rawPath;
  if (config.pathTransforms) {
    for (const [search, replace] of Object.entries(config.pathTransforms)) {
      path = path.replace(new RegExp(search, 'g'), replace);
    }
  }
  return path;
}

export type ResolvedResult =
  | {
      type: 'node_module';
      name: string;
      path: string;
    }
  | {
      type: 'source_file';
      path: string;
    }
  | {
      type: 'unresolved';
      path: string;
    };

export function resolveImport(
  rawPath: string,
  cwd: string,
  config: TraverseConfig,
): ResolvedResult {
  let path = transformPath(rawPath, config);
  const dependencyName = getDependencyName(path, config);

  if (dependencyName) {
    return {
      type: 'node_module',
      name: dependencyName,
      path,
    };
  }

  try {
    return {
      type: 'source_file',
      path: resolve
        .sync(path, {
          basedir: cwd,
          extensions: config.extensions,
          moduleDirectory: config.moduleDirectory,
        })
        .replace(/\\/g, '/'),
    };
  } catch (e) {}

  // import { random } from '@helpers'
  if (config.aliases[`${path}/`]) {
    // append a slash to the path so that the resolve logic below recognizes this as an /index import
    path = `${path}/`;
  }

  // import random from '@helpers/random' > '@helpers/random'.startsWith('@helpers/')
  const aliases = Object.keys(config.aliases).filter((alias) =>
    path.startsWith(alias),
  );

  for (const alias of aliases) {
    for (const alt of config.aliases[alias]) {
      try {
        return {
          type: 'source_file',
          path: resolve
            .sync(path.replace(alias, alt), {
              basedir: cwd,
              extensions: config.extensions,
              moduleDirectory: config.moduleDirectory,
            })
            .replace(/\\/g, '/'),
        };
      } catch (e) {}
    }
  }

  // last attempt, try prefix the path with ./, `import 'index' to `import './index'`
  // can be useful for the entry files
  try {
    return {
      type: 'source_file',
      path: resolve
        .sync(`./${path}`, {
          basedir: cwd,
          extensions: config.extensions,
          moduleDirectory: config.moduleDirectory,
        })
        .replace(/\\/g, '/'),
    };
  } catch (e) {}

  // if nothing else works out :(
  return {
    type: 'unresolved',
    path: path,
  };
}

const VueScriptRegExp = new RegExp(
  '<script(?:(\\s?(?<key>lang|setup|src))(?:=[\'"](?<value>.+)[\'"])?)*\\s?\\/?>',
  'i',
);

function extractFromScriptTag(code: string) {
  const lines = code.split('\n');
  const start: number[] = [];
  const end: number[] = [];

  // walk the code from start to end to find the first <script> tag on it's own line
  for (let idx = 0; idx < lines.length; idx++) {
    const matches = lines[idx].match(VueScriptRegExp);
    if (!matches) {
      continue;
    }

    if (matches.groups?.key === 'src') {
      return `import '${matches.groups?.value.trim()}';`;
    }

    start.push(idx);

    if (start.length === 2) {
      break;
    }
  }

  // walk the code in reverse to find the last </script> tag on it's own line
  for (let idx = lines.length - 1; idx >= 0; idx--) {
    if (lines[idx].trim() === '</script>') {
      end.push(idx);
    }
    if (end.length === 2) {
      break;
    }
  }

  let str = '';

  if (start.length > 0 && end.length > 0) {
    const endReversed = end.reverse();
    start.forEach((value, index) => {
      str += lines.slice(value + 1, endReversed[index]).join('\n');
    });
  }

  return str;
}

// removeFlowTypes checks for pragmas, we use app arguments to override and
// strip flow annotations from all files, regardless if it contains the pragma.
function handleFlowType(code: string, config: TraverseConfig) {
  // note that we've patched `flow-remove-types` to strip import kinds,
  // but not the statements
  return removeFlowTypes(code, { all: config.flow }).toString();
}

async function parse(path: string, config: TraverseConfig): Promise<FileStats> {
  log.info('parse %s', path);

  const stats: FileStats = {
    path,
    extname: extname(path),
    dirname: dirname(path),
    imports: [],
  };

  let code = await fs.readText(path);

  // Let's just assume that nobody is going to write flow in .ts files.
  if (stats.extname !== '.ts' && stats.extname !== '.tsx') {
    code = handleFlowType(code, config);
  }

  if (stats.extname === '.vue') {
    code = extractFromScriptTag(code);
  }

  // this jsx check isn't bullet proof, but I have no idea how we can deal with
  // this better. The parser will fail on generics like <T> in jsx files, if we
  // don't specify those as being jsx.
  const ast = parseEstree(code, {
    comment: false,
    jsx: stats.extname !== '.ts',
  });

  simpleTraverse(ast, {
    enter(node) {
      let target: string | undefined;

      switch (node.type) {
        // import x from './x';
        case AST_NODE_TYPES.ImportDeclaration:
          if (!node.source.value) {
            break;
          }
          target = node.source.value;
          break;

        // export { x } from './x';
        case AST_NODE_TYPES.ExportNamedDeclaration:
          if (!node.source?.value) {
            break;
          }
          target = node.source.value;
          break;

        // export * from './x';
        case AST_NODE_TYPES.ExportAllDeclaration:
          if (!node.source) {
            break;
          }

          target = node.source.value;
          break;

        // import('.x') || await import('.x')
        case AST_NODE_TYPES.ImportExpression:
          const { source } = node;
          if (!source) {
            break;
          }

          if (source.type === 'TemplateLiteral') {
            // Allow for constant template literals, import(`.x`)
            if (source.expressions.length === 0 && source.quasis.length === 1) {
              target = source.quasis[0].value.cooked;
            }
          } else {
            target = (source as Literal).value as string;
          }
          break;

        // require('./x') || await require('./x')
        case AST_NODE_TYPES.CallExpression: {
          if ((node.callee as Identifier)?.name !== 'require') {
            break;
          }

          const [argument] = node.arguments;

          if (argument.type === 'TemplateLiteral') {
            // Allow for constant template literals, require(`.x`)
            if (
              argument.expressions.length === 0 &&
              argument.quasis.length === 1
            ) {
              target = argument.quasis[0].value.cooked;
            }
          } else {
            target = (argument as Literal).value as string;
          }
          break;
        }
      }

      if (target) {
        const resolved = resolveImport(target, stats.dirname, config);
        stats.imports.push(resolved);
      }
    },
  });

  return stats;
}

export const getResultObject = () => ({
  unresolved: new Map<string, string[]>(),
  modules: new Set<string>(),
  files: new Map<string, FileStats>(),
});

export interface TraverseConfig {
  aliases: MapLike<string[]>;
  extensions: string[];
  assetExtensions: string[];
  moduleDirectory: string[];
  cacheId?: string;
  flow?: boolean;
  preset?: string;
  dependencies: MapLike<string>;
  pathTransforms?: MapLike<string>;
  root: string;
}

export async function traverse(
  path: string | string[],
  config: TraverseConfig,
  result = getResultObject(),
): Promise<TraverseResult> {
  if (Array.isArray(path)) {
    await Promise.all(path.map((x) => traverse(x, config, result)));
    return result;
  }

  path = path.replace(/\\/g, '/');

  // be sure to only process each file once, and not end up in recursion troubles
  if (result.files.has(path)) {
    return result;
  }

  // only process code files, no json or css
  const ext = extname(path);
  if (!config.extensions.includes(ext)) {
    if (config.assetExtensions.includes(ext)) {
      result.files.set(path, {
        path,
        extname: extname(path),
        dirname: dirname(path),
        imports: [],
      });
    }
    return result;
  }

  let parseResult: FileStats;
  try {
    const generator = () => parse(String(path), config);

    parseResult = config.cacheId
      ? await resolveEntry(path, generator, config.cacheId)
      : await parse(path, config);
    result.files.set(path, parseResult);

    for (const file of parseResult.imports) {
      switch (file.type) {
        case 'node_module':
          result.modules.add(file.name);
          break;
        case 'unresolved':
          const current = result.unresolved.get(file.path) || [];
          const path = relative(config.root, parseResult.path);
          const next = current.includes(path) ? current : [...current, path];
          result.unresolved.set(file.path, next);
          break;
        case 'source_file':
          if (result.files.has(file.path)) {
            break;
          }
          await traverse(file.path, config, result);
          break;
      }
    }
  } catch (error) {
    if (config.cacheId) {
      invalidateEntry(path);
      invalidateEntries<FileStats>((meta) => {
        // Invalidate anyone referencing this file
        return !!meta.imports.find((x) => x.path === path);
      });
    }

    if (error instanceof Error && !(error instanceof InvalidCacheError)) {
      throw InvalidCacheError.wrap(error, path);
    }

    throw error;
  }

  return result;
}

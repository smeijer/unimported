import { dirname, extname } from 'path';
import { Context } from './index';
import {
  AST_NODE_TYPES,
  parse as parseEstree,
  TSESTree,
} from '@typescript-eslint/typescript-estree';
import * as fs from './fs';
import Traverser from 'eslint/lib/shared/traverser';
import type {
  Identifier,
  Literal,
} from '@typescript-eslint/types/dist/ts-estree';
import resolve from 'resolve';
import chalk from 'chalk';
import removeFlowTypes from 'flow-remove-types';
import { invalidateEntry, resolveEntry } from './cache';

export interface FileStats {
  path: string;
  extname: string;
  dirname: string;
  imports: ResolvedResult[];
}

export interface TraverseResult {
  unresolved: Set<string>;
  files: Map<string, FileStats>;
  modules: Set<string>;
}

function getDependencyName(path: string, context: Context): string | null {
  if (context.type === 'meteor' && path.startsWith('meteor/')) {
    return path;
  }

  const [namespace, module] = path.split('/');
  const name = path[0] === '@' ? `${namespace}/${module}` : namespace;

  if (context.dependencies[name]) {
    return name;
  }

  if (context.dependencies[`@types/${name}`]) {
    return `@types/${name}`;
  }

  return null;
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
  path: string,
  cwd: string,
  context: Context,
): ResolvedResult {
  const dependencyName = getDependencyName(path, context);

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
          extensions: context.extensions,
          moduleDirectory: context.moduleDirectory,
        })
        .replace(/\\/g, '/'),
    };
  } catch (e) {}

  const aliases = Object.keys(context.aliases).filter((alias) =>
    path.startsWith(alias),
  );

  for (const alias of aliases) {
    for (const alt of context.aliases[alias]) {
      try {
        return {
          type: 'source_file',
          path: resolve
            .sync(path.replace(alias, alt), {
              basedir: cwd,
              extensions: context.extensions,
              moduleDirectory: context.moduleDirectory,
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
          extensions: context.extensions,
          moduleDirectory: context.moduleDirectory,
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

async function parse(path: string, context: Context): Promise<FileStats> {
  const stats: FileStats = {
    path,
    extname: extname(path),
    dirname: dirname(path),
    imports: [],
  };

  // this jsx check isn't bullet proof, but I have no idea how we can deal with
  // this better. The parser will fail on generics like <T> in jsx files, if we
  // don't specify those as being jsx.
  let code = await fs.readText(path);

  // removeFlowTypes checks for pragma's, use app arguments to override and
  // strip flow annotations from all files, regardless if it contains the pragma
  code = removeFlowTypes(code, { all: context.flow });

  const ast = parseEstree(code, {
    comment: false,
    jsx: stats.extname !== '.ts',
  });

  Traverser.traverse(ast, {
    enter(node: TSESTree.Node) {
      let target;

      switch (node.type) {
        // import x from './x';
        case AST_NODE_TYPES.ImportDeclaration:
          if (!node.source || !(node.source as Literal).value) {
            break;
          }
          target = (node.source as Literal).value as string;
          break;

        // export { x } from './x';
        case AST_NODE_TYPES.ExportNamedDeclaration:
          if (!node.source || !(node.source as Literal).value) {
            break;
          }
          target = (node.source as Literal).value as string;
          break;

        // export * from './x';
        case AST_NODE_TYPES.ExportAllDeclaration:
          if (!node.source) {
            break;
          }

          target = (node.source as Literal).value as string;
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
            target = (source as Literal).value;
          }
          break;

        // require('./x') || await require('./x')
        case AST_NODE_TYPES.CallExpression: {
          if ((node.callee as Identifier)?.name !== 'require') {
            break;
          }

          target = (node.arguments[0] as Literal).value;
          break;
        }
      }

      if (target) {
        const resolved = resolveImport(target, stats.dirname, context);
        stats.imports.push(resolved);
      }
    },
  });

  return stats;
}

const getResultObject = () => ({
  unresolved: new Set<string>(),
  modules: new Set<string>(),
  files: new Map<string, FileStats>(),
});

export async function traverse(
  path: string | string[],
  context: Context,
  result = getResultObject(),
): Promise<TraverseResult> {
  if (Array.isArray(path)) {
    await Promise.all(path.map((x) => traverse(x, context, result)));
    return result;
  }

  // be sure to only process each file once, and not end up in recursion troubles
  if (result.files.has(path)) {
    return result;
  }

  // only process code files, no json or css
  if (!context.extensions.includes(extname(path))) {
    return result;
  }

  let parseResult;
  try {
    parseResult = await resolveEntry(path, () => parse(path, context));
    result.files.set(path, parseResult);

    for (const file of parseResult.imports) {
      switch (file.type) {
        case 'node_module':
          result.modules.add(file.name);
          break;
        case 'unresolved':
          result.unresolved.add(file.path);
          break;
        case 'source_file':
          if (result.files.has(file.path)) {
            break;
          }
          await traverse(file.path, context, result);
          break;
      }
    }
  } catch (e) {
    invalidateEntry(path);
    if (!e.path) {
      e.path = path;
    }
    throw e;
  }

  return result;
}

import { TraverseResult } from './traverse';
import { Context } from './index';
import { ensureArray } from './ensureArray';
import minimatch from 'minimatch';

export interface ProcessedResult {
  unresolved: string[];
  unimported: string[];
  unused: string[];
  clean: boolean;
}

function index(array: string | string[]): { [key: string]: boolean } {
  return ensureArray(array).reduce((acc, str) => {
    acc[str] = true;
    return acc;
  }, {});
}

export async function processResults(
  files: string[],
  traverseResult: TraverseResult,
  context: Context,
): Promise<ProcessedResult> {
  const ignoreUnresolvedIdx = index(context.config.ignoreUnresolved);
  const ignoreUnused = context.config.ignoreUnused;
  const ignoreUnimportedIdx = index(context.config.ignoreUnimported);

  const unresolved = Array.from(traverseResult.unresolved).filter(
    (x) => !ignoreUnresolvedIdx[x],
  );

  const unused = Object.keys(context.dependencies).filter(
    (x) =>
      !traverseResult.modules.has(x) &&
      !context.peerDependencies[x] &&
      !ignoreUnused.some((ignore) => x === ignore || minimatch(x, ignore)),
  );

  const unimported = files
    .filter((x) => !traverseResult.files.has(x))
    .map((x) => x.substr(context.cwd.length + 1))
    .filter((x) => !ignoreUnimportedIdx[x]);

  return {
    unresolved,
    unused,
    unimported,
    clean: !unresolved.length && !unused.length && !unimported.length,
  };
}

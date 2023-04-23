import { processResults, ProcessedResult } from '../process';
import { Context } from '../index';
import { FileStats, TraverseResult } from '../traverse';

describe('processResults', () => {
  it('returns clean result when all format types are disabled', async () => {
    const files = ['src/index.ts'];
    const traverseResult: TraverseResult = {
      unresolved: new Map<string, string[]>([['foo', ['bar']]]),
      modules: new Set<string>(),
      files: new Map<string, FileStats>(),
    };
    const context: Context = {
      cwd: 'cwd/string',
      moduleDirectory: [],
      dependencies: {},
      peerDependencies: {},
      config: {
        version: '1.0.0',
        entryFiles: [{ file: 'src/main.js', aliases: {}, extensions: [] }],
        extensions: [],
        ignorePatterns: [],
        ignoreUnimported: [],
        ignoreUnused: [],
        ignoreUnresolved: [],
      },
      showUnusedFiles: false,
      showUnusedDeps: false,
      showUnresolvedImports: false,
    };

    const result = await processResults(files, traverseResult, context);

    const expected: ProcessedResult = {
      unresolved: [['foo', ['bar']]],
      unused: [],
      unimported: ['src/index.ts'],
      clean: false,
    };

    expect(result).toEqual(expected);
  });
  it('returns unresolved imports when showUnresolvedImports is true', async () => {
    const files = ['src/index.ts'];
    const traverseResult: TraverseResult = {
      unresolved: new Map<string, string[]>(),
      modules: new Set<string>(),
      files: new Map<string, FileStats>(),
    };
    const context: Context = {
      cwd: 'cwd/string',
      moduleDirectory: [],
      dependencies: {},
      peerDependencies: {},
      config: {
        version: '1.0.0',
        entryFiles: [
          { file: 'src/client/main.js', aliases: {}, extensions: [] },
        ],
        extensions: [],
        ignorePatterns: [],
        ignoreUnimported: [],
        ignoreUnused: [],
        ignoreUnresolved: [],
      },
      showUnusedFiles: false,
      showUnusedDeps: false,
      showUnresolvedImports: true,
    };

    const result = await processResults(files, traverseResult, context);

    const expected: ProcessedResult = {
      unresolved: [],
      unused: [],
      unimported: ['src/index.ts'],
      clean: true,
    };

    expect(result).toEqual(expected);
  });
  it('returns unused dependencies when showUnusedDeps is true', async () => {
    const files = ['src/index.ts'];
    const traverseResult: TraverseResult = {
      unresolved: new Map<string, string[]>(),
      modules: new Set<string>(),
      files: new Map<string, FileStats>(),
    };
    const context: Context = {
      cwd: 'cwd/string',
      moduleDirectory: [],
      dependencies: {},
      peerDependencies: {},
      config: {
        version: '1.0.0',
        entryFiles: [
          { file: 'src/client/main.js', aliases: {}, extensions: [] },
        ],
        extensions: [],
        ignorePatterns: [],
        ignoreUnimported: [],
        ignoreUnused: [],
        ignoreUnresolved: [],
      },
      showUnusedFiles: false,
      showUnusedDeps: true,
      showUnresolvedImports: false,
    };

    const result = await processResults(files, traverseResult, context);

    const expected: ProcessedResult = {
      unresolved: [],
      unused: [],
      unimported: ['src/index.ts'],
      clean: true,
    };

    expect(result).toEqual(expected);
  });
  it('returns unimported files when showUnusedFiles is true', async () => {
    const files = ['src/index.ts'];
    const traverseResult: TraverseResult = {
      unresolved: new Map<string, string[]>([['foo', ['bar']]]),
      modules: new Set<string>(),
      files: new Map<string, FileStats>([
        [
          'src/index.ts',
          {
            path: '',
            extname: '',
            dirname: '',
            imports: [],
          },
        ],
      ]),
    };
    const context: Context = {
      cwd: 'cwd/string',
      moduleDirectory: [],
      dependencies: {},
      peerDependencies: {},
      config: {
        version: '1.0.0',
        entryFiles: [
          { file: 'src/client/main.js', aliases: {}, extensions: [] },
        ],
        extensions: [],
        ignorePatterns: [],
        ignoreUnimported: [],
        ignoreUnused: [],
        ignoreUnresolved: [],
      },
      showUnusedFiles: true,
      showUnusedDeps: false,
      showUnresolvedImports: false,
    };

    const result = await processResults(files, traverseResult, context);

    const expected: ProcessedResult = {
      unresolved: [['foo', ['bar']]],
      unused: [],
      unimported: [],
      clean: true,
    };

    expect(result).toEqual(expected);
  });
});

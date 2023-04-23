import { processResults, ProcessedResult } from '../process';
import { Context } from '../index';
import { FileStats } from '../traverse';

describe('processResults', () => {
  it('returns clean result when all format types are disabled', async () => {
    const files = ['src/index.ts'];
    const traverseResult = {
      unresolved: new Set<string>(['foo']),
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
      unresolved: ['foo'],
      unused: [],
      unimported: ['src/index.ts'],
      clean: false,
    };

    expect(result).toEqual(expected);
  });
  it('returns unresolved imports when showUnresolvedImports is true', async () => {
    const files = ['src/index.ts'];
    const traverseResult = {
      unresolved: new Set<string>(),
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
    const traverseResult = {
      unresolved: new Set<string>(),
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
    const traverseResult = {
      unresolved: new Set<string>(['foo']),
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
      unresolved: ['foo'],
      unused: [],
      unimported: [],
      clean: true,
    };

    expect(result).toEqual(expected);
  });
});

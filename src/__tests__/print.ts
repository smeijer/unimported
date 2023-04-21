import { createConsole, getLog, mockConsole } from 'console-testing-library';
import { Context } from '../index';
import { printDeleteResult, printResults } from '../print';

describe('printResults', () => {
  const expectedContext = {
    cwd: 'cwd/string',
    moduleDirectory: [],
    dependencies: {},
    peerDependencies: {},
    config: {
      version: '1.0.0',
      entryFiles: [{ file: 'src/client/main.js', aliases: {}, extensions: [] }],
      extensions: [],
      ignorePatterns: [],
      ignoreUnimported: [],
      ignoreUnused: [],
      ignoreUnresolved: [],
    },
    showUnresolvedImports: false,
    showUnusedDeps: false,
    showUnusedFiles: false,
  } as Context;

  let restore: any;
  beforeEach(() => {
    const strippingConsole = createConsole({ stripAnsi: true });
    restore = mockConsole(strippingConsole);
  });
  afterEach(() => {
    jest.clearAllMocks();
    restore();
  });

  it('should print once to console if results are clean', () => {
    const expectedProcessedResult = {
      unresolved: [],
      unimported: [],
      unused: [],
      clean: true,
    };
    printResults(expectedProcessedResult, expectedContext);

    expect(getLog().log).toMatchInlineSnapshot(
      `"✓ There don't seem to be any unimported files."`,
    );
  });

  it('should print summary and unresolved, unimported, and unused tables populated', () => {
    const expectedProcessedResult = {
      unresolved: <[string, string[]][]>[['string', ['string']]],
      unimported: ['string', 'string', 'string', 'string'],
      unused: ['string', 'string', 'string'],
      clean: false,
    };
    printResults(expectedProcessedResult, expectedContext);

    expect(getLog().log).toMatchInlineSnapshot(`
      "
             summary               unimported v1.0.0
      ────────────────────────────────────────────────────────────────────────────────
             entry file          : src/client/main.js

             unresolved imports  : 1
             unused dependencies : 3
             unimported files    : 4


      ─────┬──────────────────────────────────────────────────────────────────────────
           │ 1 unresolved imports
      ─────┼──────────────────────────────────────────────────────────────────────────
         1 │ string from string  
      ─────┴──────────────────────────────────────────────────────────────────────────


      ─────┬──────────────────────────────────────────────────────────────────────────
           │ 3 unused dependencies
      ─────┼──────────────────────────────────────────────────────────────────────────
         1 │ string
         2 │ string
         3 │ string
      ─────┴──────────────────────────────────────────────────────────────────────────


      ─────┬──────────────────────────────────────────────────────────────────────────
           │ 4 unimported files
      ─────┼──────────────────────────────────────────────────────────────────────────
         1 │ string
         2 │ string
         3 │ string
         4 │ string
      ─────┴──────────────────────────────────────────────────────────────────────────


             Inspect the results and run npx unimported -u to update ignore lists"
    `);
  });
  describe('printDeleteResult', () => {
    it('should print summary of removed files and packages', () => {
      printDeleteResult({
        removedDeps: ['unused-package'],
        deletedFiles: ['unused-file.txt'],
      });
      expect(getLog().log).toMatchInlineSnapshot(`
              "
              ─────┬──────────────────────────────────────────────────────────────────────────
                   │ 1 unused dependencies removed
              ─────┼──────────────────────────────────────────────────────────────────────────
                 1 │ unused-package
              ─────┴──────────────────────────────────────────────────────────────────────────


              ─────┬──────────────────────────────────────────────────────────────────────────
                   │ 1 unused files removed
              ─────┼──────────────────────────────────────────────────────────────────────────
                 1 │ unused-file.txt
              ─────┴──────────────────────────────────────────────────────────────────────────
              "
          `);
    });
    it('should print summary of removed packages', () => {
      printDeleteResult({
        removedDeps: ['unused-package'],
        deletedFiles: [],
      });
      expect(getLog().log).toMatchInlineSnapshot(`
        "✓ There are no unused files.

        ─────┬──────────────────────────────────────────────────────────────────────────
             │ 1 unused dependencies removed
        ─────┼──────────────────────────────────────────────────────────────────────────
           1 │ unused-package
        ─────┴──────────────────────────────────────────────────────────────────────────
        "
      `);
    });
    it('should print summary of removed files', () => {
      printDeleteResult({
        removedDeps: [],
        deletedFiles: ['unused-file.txt'],
      });
      expect(getLog().log).toMatchInlineSnapshot(`
        "✓ There are no unused dependencies.

        ─────┬──────────────────────────────────────────────────────────────────────────
             │ 1 unused files removed
        ─────┼──────────────────────────────────────────────────────────────────────────
           1 │ unused-file.txt
        ─────┴──────────────────────────────────────────────────────────────────────────
        "
      `);
    });
    it('should print summary when nothing is removed', () => {
      printDeleteResult({
        removedDeps: [],
        deletedFiles: [],
      });
      expect(getLog().log).toMatchInlineSnapshot(
        `"✓ There are no unused files or dependencies."`,
      );
    });
  });
});

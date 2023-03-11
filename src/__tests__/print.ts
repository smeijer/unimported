import { createConsole, getLog, mockConsole } from 'console-testing-library';
import { Context } from '../index';
import { printDeletedFiles, printRemovedDeps, printResults } from '../print';

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

  it('should print summary of removed packages', () => {
    printRemovedDeps(['unused-package']);
    expect(getLog().log).toMatchInlineSnapshot(`
      "
      ─────┬──────────────────────────────────────────────────────────────────────────
           │ 1 unused dependencies removed
      ─────┼──────────────────────────────────────────────────────────────────────────
         1 │ unused-package
      ─────┴──────────────────────────────────────────────────────────────────────────
      "
    `);
  });
  it('should print summary of deleted files', () => {
    printDeletedFiles(['file.text']);
    expect(getLog().log).toMatchInlineSnapshot(`
      "
      ─────┬──────────────────────────────────────────────────────────────────────────
           │ 1 unimported files deleted
      ─────┼──────────────────────────────────────────────────────────────────────────
         1 │ file.text
      ─────┴──────────────────────────────────────────────────────────────────────────
      "
    `);
  });

  it('should print summary and unresolved, unimported, and unused tables populated', () => {
    const expectedProcessedResult = {
      unresolved: ['string', 'string'],
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

             unresolved imports  : 2
             unused dependencies : 3
             unimported files    : 4


      ─────┬──────────────────────────────────────────────────────────────────────────
           │ 2 unresolved imports
      ─────┼──────────────────────────────────────────────────────────────────────────
         1 │ string
         2 │ string
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
});

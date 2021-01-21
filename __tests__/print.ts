import { formatList, formatMetaTable, printResults } from '../src/print';
import { Context } from '../src/index';

describe('formatList', () => {
  it('should return a formatted list with a caption', () => {
    const expectedRecords = ['record one', 'record two', 'record three'];
    const result = formatList('caption text', expectedRecords);
    expect(result).toMatchInlineSnapshot(`
      "
      [90m─────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────[39m
      [90m     │ [39m[97mcaption text[39m
      [90m─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────[39m
      [90m   1 │ [39m[37mrecord one[39m
      [90m   2 │ [39m[37mrecord two[39m
      [90m   3 │ [39m[37mrecord three[39m
      [90m─────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────[39m
      "
    `);
  });
});

describe('formatMetaTable', () => {
  const expectedContext = {
    version: '1.0.0',
    cwd: 'cwd/string',
    entry: ['src/client/main.js'],
  } as Context;
  it('should return a formatted meta table with empty data arrays', () => {
    const expectedData = {
      unresolved: [],
      unimported: [],
      unused: [],
    };

    const result = formatMetaTable(
      'caption text',
      expectedData,
      expectedContext,
    );

    expect(result).toMatchInlineSnapshot(`
      "
             caption text               [90munimported v1.0.0[39m
      [90m─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────[39m
             entry file          : main.js

             unresolved imports  : 0
             unused dependencies : 0
             unimported files    : 0
      "
    `);
  });

  it('should return a formatted meta table with data arrays populated', () => {
    const expectedData = {
      unresolved: ['string', 'string'],
      unimported: ['string', 'string', 'string', 'string'],
      unused: ['string', 'string', 'string'],
    };

    const result = formatMetaTable(
      'caption text',
      expectedData,
      expectedContext,
    );

    expect(result).toMatchInlineSnapshot(`
      "
             caption text               [90munimported v1.0.0[39m
      [90m─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────[39m
             entry file          : main.js

             unresolved imports  : 2
             unused dependencies : 3
             unimported files    : 4
      "
    `);
  });
});

describe('printResults', () => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  const expectedContext = {
    version: '1.0.0',
    cwd: 'cwd/string',
    entry: ['src/client/main.js'],
  } as Context;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should print once to console if results are clean', () => {
    const expectedProcessedResult = {
      unresolved: [],
      unimported: [],
      unused: [],
      clean: true,
    };
    printResults(expectedProcessedResult, expectedContext);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  it('should print results to console', () => {
    const expectedProcessedResult = {
      unresolved: ['string', 'string'],
      unimported: ['string', 'string', 'string', 'string'],
      unused: ['string', 'string', 'string'],
      clean: false,
    };
    printResults(expectedProcessedResult, expectedContext);
    expect(consoleSpy).toHaveBeenCalledTimes(5);
  });
});

import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

test('npx unimported --help', async () => {
  // the async call below can take longer than the default 5 seconds,
  // so increase as necessary.
  jest.setTimeout(10000);

  // note about `./` path: jest executes the tests from the root directory
  let execResults;
  if (process.platform === 'win32') {
    // Windows won't understand LC_ALL='en'
    execResults = await execAsync(
      `set LC_All='en' && set NODE_ENV='production' && ts-node src/index.ts --help`,
    );
  } else {
    execResults = await execAsync(
      `LC_ALL='en' NODE_ENV='production' ts-node src/index.ts --help`,
    );
  }

  const { stdout, stderr } = execResults;

  expect(stderr).toBe('');
  expect(stdout.trim()).toMatchInlineSnapshot(`
    "unimported [cwd]

    scan your project for dead files

    Positionals:
      cwd  The root directory that unimported should run from.              [string]

    Options:
          --version           Show version number                          [boolean]
          --help              Show help                                    [boolean]
          --cache             Whether to use the cache. Disable the cache using
                              --no-cache.                  [boolean] [default: true]
          --clear-cache       Clears the cache file and then exits.        [boolean]
      -f, --flow              Whether to strip flow types, regardless of @flow
                              pragma.                                      [boolean]
          --ignore-untracked  Ignore files that are not currently tracked by git.
                                                                           [boolean]
      -i, --init              Dump default settings to .unimportedrc.json. [boolean]
          --show-config       Show config and then exists.                 [boolean]
          --show-preset       Show preset and then exists.                  [string]
      -u, --update            Update the ignore-lists stored in .unimportedrc.json.
                                                                           [boolean]"
  `);
});

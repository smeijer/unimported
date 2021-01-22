import util from 'util';

const exec = util.promisify(require('child_process').exec);

test('npx unimported --help', async () => {
  // note about `./` path: jest executes the tests from the root directory
  const { stdout, stderr } = await exec('ts-node ./src/index.js --help');

  expect(stderr).toBe('');
  expect(stdout.trim()).toMatchInlineSnapshot(`
      "unimported

      scan your project for dead files

      Options:
        --version     Show version number                                    [boolean]
        --help        Show help                                              [boolean]
        --init, -i    dump default settings to .unimportedrc.json            [boolean]
        --flow, -f    indicates if your code is annotated with flow types    [boolean]
        --update, -u  update the ignore-lists stored in .unimportedrc.json   [boolean]"
    `);
});

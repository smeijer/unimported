import util from 'util';

const exec = util.promisify(require('child_process').exec);

test('npx unimported --help', async (done) => {
  // note about `./` path: jest executes the tests from the root directory
  await exec('node ./bin/unimported.js --help', async (error, stdout, stderr) => {
    await expect(error).toBe(null);
    await expect(stderr).toBe('');
    await expect(stdout.trim()).toMatchInlineSnapshot(`
      "unimported

      scan your project for dead files

      Options:
        --version     Show version number                                    [boolean]
        --help        Show help                                              [boolean]
        --init, -i    dump default settings to .unimportedrc.json            [boolean]
        --flow, -f    indicates if your code is annotated with flow types    [boolean]
        --update, -u  update the ignore-lists stored in .unimportedrc.json   [boolean]"
    `);
    done();
  });
});

test('npx unimported --help', async (done) => {
  // note about `./` path: jest executes the tests from the root directory
  // wrong file name
  await exec('node ./bin/1unimported.js --help', async (error, stdout, stderr) => {
    await expect(error).not.toBe(null);
    await expect(stderr).not.toBe(null);
    await expect(stdout).toBe('');

    done();
  });
});

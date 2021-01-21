import util from 'util';

const exec = util.promisify(require('child_process').exec);

test('npx unimported --help', (done) => {
  // note about `./` path: jest executes the tests from the root directory
  exec('node ./bin/unimported.js --help', (error, stdout, stderr) => {
    expect(error).toBe(null);
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
    done();
  });
});

test('npx unimported --help', (done) => {
  // note about `./` path: jest executes the tests from the root directory
  // wrong file name
  exec('node ./bin/1unimported.js --help', (error, stdout, stderr) => {
    expect(error).not.toBe(null);
    expect(stderr).not.toBe(null);
    expect(stdout).toBe('');

    done();
  });
});

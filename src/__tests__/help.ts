import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

test('npx unimported --help', async () => {
  // note about `./` path: jest executes the tests from the root directory
  let execResults;
  if (process.platform === 'win32') {
    // Windows won't understand LC_ALL='en'
    execResults = await execAsync(
      `set LC_All='en' && ts-node src/index.ts --help`,
    );
  } else {
    execResults = await execAsync(`LC_ALL='en' ts-node src/index.ts --help`);
  }

  const { stdout, stderr } = execResults;

  expect(stderr).toBe('');
  expect(stdout.trim()).toMatchInlineSnapshot(`
    "unimported
    
    scan your project for dead files
    
    Options:
          --version  Show version number                                   [boolean]
          --help     Show help                                             [boolean]
      -i, --init     dump default settings to .unimportedrc.json           [boolean]
      -f, --flow     indicates if your code is annotated with flow types   [boolean]
      -u, --update   update the ignore-lists stored in .unimportedrc.json  [boolean]"
    `);
});

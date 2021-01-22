import fs from 'fs';
import path from 'path';
import util from 'util';
import childProcess from 'child_process';

const mkdir = util.promisify(fs.mkdir);
const rmdir = util.promisify(fs.rmdir);
const writeFile = util.promisify(fs.writeFile);

function exec(
  command: string,
  options: { cwd: string },
): Promise<{ exitCode: number | null; stdout: string }> {
  return new Promise((resolve) => {
    try {
      const buffer = childProcess.execSync(command, options);
      resolve({ exitCode: 0, stdout: buffer.toString() });
    } catch (ex) {
      resolve({ exitCode: ex.status, stdout: ex.stdout.toString() });
    }
  });
}

async function createProject(
  files: Array<{ name: string; content: string }>,
): Promise<string> {
  const randomId = Math.floor(Math.random() * 1000000);

  const testSpaceDir = path.join('.test-space', randomId.toString());

  await mkdir(testSpaceDir, { recursive: true });

  await Promise.all(
    files.map((file) =>
      writeFile(path.join(testSpaceDir, file.name), file.content),
    ),
  );

  return testSpaceDir;
}

const scenarios = [
  {
    description: 'should identify unimported file',
    files: [
      { name: 'package.json', content: '{ "main": "index.js" }' },
      { name: 'index.js', content: `import foo from './foo';` },
      { name: 'foo.js', content: '' },
      { name: 'bar.js', content: '' },
    ],
    exitCode: 1,
    output: ['1 unimported files', 'bar.js'],
  },
  {
    description: 'should identify unused dependencies',
    files: [
      {
        name: 'package.json',
        content:
          '{ "main": "index.js", "dependencies": { "@test/dependency": "1.0.0" } }',
      },
      { name: 'index.js', content: `import foo from './foo';` },
      { name: 'foo.js', content: '' },
    ],
    exitCode: 1,
    output: ['1 unused dependencies', '@test/dependency'],
  },
];

describe('cli integration tests', () => {
  scenarios.forEach((scenario) => {
    test(scenario.description, async () => {
      const testProjectDir = await createProject(scenario.files);
      const executable = path.join(
        path.relative(testProjectDir, 'bin'),
        'unimported.js',
      );

      try {
        const { stdout, exitCode } = await exec(`node ${executable}`, {
          cwd: testProjectDir,
        });

        expect(exitCode).toBe(scenario.exitCode);
        scenario.output.forEach((expectedOutput) => {
          expect(stdout).toEqual(expect.stringContaining(expectedOutput));
        });
      } finally {
        await rmdir(testProjectDir, { recursive: true });
      }
    });
  });
});

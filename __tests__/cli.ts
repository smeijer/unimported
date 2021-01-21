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
    const process = childProcess.exec(command, options, (_error, stdout) => {
      resolve({ exitCode: process.exitCode, stdout });
    });
  });
}

const projectFixture = [
  { name: 'package.json', content: '{ "main": "index.js" }' },
  { name: 'index.js', content: `import foo from './foo';` },
  { name: 'foo.js', content: '' },
  { name: 'bar.js', content: '' },
];

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

let testProjectDir: string, executable: string;

beforeEach(async () => {
  testProjectDir = await createProject(projectFixture);
  executable = path.join(path.relative(testProjectDir, 'bin'), 'unimported.js');
});

afterEach(() => rmdir(testProjectDir, { recursive: true }));

test('should identify unimported file', async () => {
  const { exitCode, stdout } = await exec(`node ${executable}`, {
    cwd: testProjectDir,
  });

  expect(exitCode).not.toBe(0);
  expect(stdout).toEqual(expect.stringContaining('1 unimported files'));
  expect(stdout).toEqual(expect.stringContaining('bar.js'));
});

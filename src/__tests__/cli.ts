import fs from 'fs';
import path from 'path';
import util from 'util';
import cases from 'jest-in-case';
import simpleGit from 'simple-git';
import { main, CliArguments } from '..';

const mkdir = util.promisify(fs.mkdir);
const rmdir = util.promisify(fs.rmdir);
const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);

jest.mock('simple-git');

async function exec(
  testProjectDir: string,
  {
    init = false,
    flow = false,
    update = false,
    ignoreUntracked = false,
  }: Partial<CliArguments> = {},
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  const originalExit = process.exit;
  const originalCwd = process.cwd();
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  try {
    let exitCode: number | null = null;
    let stdout = '';
    let stderr = '';

    const appendStdout = (...args: any[]): void => {
      stdout += args.map((arg) => arg.toString()).join(' ');
    };

    const appendStderr = (...args: any[]): void => {
      stderr += args.map((arg) => arg.toString()).join(' ');
    };

    console.log = appendStdout;
    console.warn = appendStdout;
    console.error = appendStderr;

    process.exit = (code: number): never => {
      exitCode = exitCode ?? code;
      return undefined as never;
    };

    process.chdir(testProjectDir);

    await main({
      init,
      flow,
      update,
      ignoreUntracked,
    });

    return { exitCode: exitCode ?? 0, stdout, stderr };
  } finally {
    process.chdir(originalCwd);
    process.exit = originalExit;
    Object.entries(originalConsole).forEach(([key, value]) => {
      console[key] = value;
    });
  }
}

async function createProject(
  files: Array<{ name: string; content: string }>,
  baseDir = '.',
): Promise<string> {
  const randomId = Math.floor(Math.random() * 1000000);

  const testSpaceDir = path.join('.test-space', randomId.toString());

  await mkdir(testSpaceDir, { recursive: true });

  await Promise.all(
    files.map((file) =>
      mkdir(path.join(testSpaceDir, path.dirname(file.name)), {
        recursive: true,
      }),
    ),
  );

  await Promise.all(
    files.map((file) =>
      writeFile(path.join(testSpaceDir, file.name), file.content),
    ),
  );

  return path.join(testSpaceDir, baseDir);
}

cases(
  'cli integration tests',
  async (scenario) => {
    const testProjectDir = await createProject(
      scenario.files,
      scenario.baseDir,
    );

    try {
      if (scenario.ignoreUntracked) {
        const status = jest.fn(async () => {
          return { not_added: scenario.untracked };
        });
        (simpleGit as jest.Mock).mockImplementationOnce(() => {
          return {
            status,
          };
        });
      }

      const { stdout, stderr, exitCode } = await exec(testProjectDir, {
        ignoreUntracked: scenario.ignoreUntracked,
      });

      expect(stdout).toMatch(scenario.stdout);
      expect(stderr).toMatch('');
      expect(exitCode).toBe(scenario.exitCode);
    } finally {
      await rmdir(testProjectDir, { recursive: true });
    }
  },
  [
    {
      name: 'should identify unimported file',
      files: [
        { name: 'package.json', content: '{ "main": "index.js" }' },
        { name: 'index.js', content: `import foo from './foo';` },
        { name: 'foo.js', content: '' },
        { name: 'bar.js', content: '' },
      ],
      exitCode: 1,
      stdout: /1 unimported files.*bar.js/s,
    },
    {
      name: 'should identify unresolved imports',
      files: [
        { name: 'package.json', content: '{ "main": "index.js" }' },
        { name: 'index.js', content: `import foo from './foo';` },
      ],
      exitCode: 1,
      stdout: /1 unresolved imports.*.\/foo/s,
    },
    {
      name: 'should ignore untracked files that are not imported',
      files: [
        { name: 'package.json', content: '{ "main": "index.js" }' },
        { name: 'index.js', content: `import foo from './foo';` },
        { name: 'foo.js', content: '' },
        { name: 'bar.js', content: '' },
      ],
      exitCode: 0,
      stdout: /There don't seem to be any unimported files./,
      ignoreUntracked: true,
      untracked: ['bar.js'],
    },
    {
      name: 'should identify unimported file in meteor project',
      files: [
        {
          name: 'package.json',
          content:
            '{ "meteor" : { "mainModule": { "client": "client.js", "server": "server.js" } } }',
        },
        { name: 'client.js', content: `import foo from './foo';` },
        { name: 'server.js', content: '' },
        { name: '.meteor/release', content: '' },
        { name: 'foo.js', content: '' },
        { name: 'bar.js', content: '' },
      ],
      exitCode: 1,
      stdout: /1 unimported files.*bar.js/s,
    },
    {
      name: 'Invalid json',
      files: [
        {
          name: '.unimportedrc.json',
          content: '{ "entry": ["index.js"} }',
        },
      ],
      exitCode: 1,
      stdout: '',
    },
    {
      name: 'next project',
      files: [
        {
          name: '.next/test.json',
          content: '{ "entry": ["index.js"] }',
        },
        {
          name: 'package.json',
          content:
            '{ "main": "index.js", "dependencies": { "@test/dependency": "1.0.0" } }',
        },
        { name: 'index.js', content: `import foo from './foo';` },
        { name: 'foo.js', content: '' },
      ],
      exitCode: 1,
      stdout: /1 unused dependencies.*@test\/dependency/s,
    },
    {
      name: 'should identify unused dependencies',
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
      stdout: /1 unused dependencies.*@test\/dependency/s,
    },
    {
      name: 'should not report issues when everything is used',
      files: [
        {
          name: 'package.json',
          content:
            '{ "main": "index.js", "dependencies": { "@test/dependency": "1.0.0" } }',
        },
        {
          name: 'index.js',
          content: `
import foo from './foo';
import bar from './bar';
`,
        },
        { name: 'foo.js', content: '' },
        { name: 'bar.js', content: 'import test from "@test/dependency"' },
      ],
      exitCode: 0,
      stdout: /There don't seem to be any unimported files./,
    },
    {
      name: 'should not report entry file loaded from config, as missing',
      files: [
        {
          name: '.unimportedrc.json',
          content: '{ "entry": ["index.js"] }',
        },
        {
          name: 'index.js',
          content: `import a from './a'`,
        },
        {
          name: 'a.js',
          content: `export default null`,
        },
      ],
      exitCode: 0,
      stdout: /There don't seem to be any unimported files/,
    },
    {
      name: 'should use all variants of import/export',
      files: [
        {
          name: 'package.json',
          content: '{ "main": "index.js" }',
        },
        {
          name: 'index.js',
          content: `import a from './a'`,
        },
        {
          name: 'a.js',
          content: `
import {b as a} from './b'
const promise = import('./d')
const templatePromise = import(\`./e\`)
export {a}
export {b} from './b'
export * from './c'
export default promise
`,
        },
        { name: 'b.js', content: 'export const b = 2;' },
        { name: 'c.js', content: 'const c = 3; export {c}' },
        { name: 'd.js', content: 'export default 42' },
        { name: 'e.js', content: 'export default 42' },
      ],
      exitCode: 0,
      stdout: /There don't seem to be any unimported files./,
    },
    {
      name: 'should identify ts paths imports',
      files: [
        { name: 'package.json', content: '{ "main": "index.ts" }' },
        { name: 'index.ts', content: `import foo from '@root/foo';` },
        { name: 'foo.ts', content: '' },
        { name: 'bar.ts', content: '' },
        {
          name: 'tsconfig.json',
          content: '{ "compilerOptions": { "paths": { "@root": ["."] } } }',
        },
      ],
      exitCode: 1,
      stdout: /1 unimported files.*bar.ts/s,
    },
    {
      name: 'should identify config alias imports',
      files: [
        { name: 'package.json', content: '{ "main": "index.ts" }' },
        { name: 'index.ts', content: `import foo from '@root/foo';` },
        { name: 'foo.ts', content: '' },
        { name: 'bar.ts', content: '' },
        {
          name: '.unimportedrc.json',
          content: '{ "aliases": { "@root": ["."] }, "rootDir": "/" }',
        },
      ],
      exitCode: 1,
      stdout: /1 unimported files.*bar.ts/s,
    },
    {
      name: 'should identify monorepo-type sibling modules',
      baseDir: 'packages/A',
      files: [
        {
          name: 'packages/A/package.json',
          content:
            '{ "main": "index.js", "repository": { "directory": "path/goes/here" } }',
        },
        {
          name: 'packages/A/index.js',
          content: `import foo from 'B/foo';`,
        },
        { name: 'packages/B/foo.js', content: '' },
        { name: 'packages/C/bar.js', content: '' },
      ],
      exitCode: 0,
      stdout: /There don't seem to be any unimported files./,
    },
    {
      name: 'should support root slash import in meteor project',
      files: [
        {
          name: 'package.json',
          content:
            '{ "meteor" : { "mainModule": { "client": "client.js", "server": "server.js" } } }',
        },
        { name: 'client.js', content: `import foo from '/foo';` },
        { name: 'server.js', content: '' },
        { name: '.meteor/release', content: '' },
        { name: 'foo.js', content: '' },
      ],
      exitCode: 0,
      stdout: /There don't seem to be any unimported files./s,
    },
    {
      name: 'should report parse failure for invalid file',
      files: [
        { name: 'package.json', content: '{ "main": "index.js" }' },
        { name: 'index.js', content: `not valid` },
      ],
      exitCode: 1,
      stdout: /Failed parsing.*\/index.js/s,
    },
    {
      name: 'should ignore non import/require paths',
      files: [
        { name: 'package.json', content: '{ "main": "index.js" }' },
        {
          name: 'index.js',
          content: `import fs from 'fs'; const dependency = fs.readFileSync('some_path.js');`,
        },
      ],
      exitCode: 0,
      stdout: '',
    },
    {
      name: 'should not report unimported file which is in ignore file',
      files: [
        { name: 'package.json', content: '{ "main": "index.js" }' },
        { name: 'index.js', content: `import foo from './foo';` },
        {
          name: '.unimportedrc.json',
          content: '{"ignoreUnimported": ["bar.js"]}',
        },
        { name: 'foo.js', content: '' },
        { name: 'bar.js', content: '' },
      ],
      exitCode: 0,
      stdout: /There don't seem to be any unimported files./s,
    },
    {
      name: 'should not report unused dependency which is in ignore file',
      files: [
        {
          name: 'package.json',
          content:
            '{ "main": "index.js", "dependencies": { "@test/dependency": "1.0.0" } }',
        },
        { name: 'index.js', content: `import foo from './foo';` },
        {
          name: '.unimportedrc.json',
          content: '{"ignoreUnused": ["@test/dependency"]}',
        },
        { name: 'foo.js', content: '' },
      ],
      exitCode: 0,
      stdout: /There don't seem to be any unimported files./s,
    },
    {
      name: 'should not report unresolved import which is in ignore file',
      files: [
        {
          name: 'package.json',
          content: '{ "main": "index.js"  }',
        },
        { name: 'index.js', content: `import foo from './foo';` },
        {
          name: '.unimportedrc.json',
          content: '{"ignoreUnresolved": ["./foo"]}',
        },
      ],
      exitCode: 0,
      stdout: /There don't seem to be any unimported files./s,
    },
    {
      name: 'should not report entry file as missing',
      files: [
        {
          name: 'package.json',
          content: '{ "main": "index.js"  }',
        },
      ],
      exitCode: 1,
      stdout: '',
    },
    {
      name: 'can work with glob patterns in config file',
      files: [
        {
          name: '.unimportedrc.json',
          content: `{
            "entry": ["src/index.tsx", "src/**/*.test.{j,t}s"],
            "ignoreUnresolved": [],
            "ignoreUnimported": ["src/setup{Proxy,Tests}.js"],
            "ignoreUnused": [],
            "ignorePatterns": ["**/node_modules/**", "**/*.d.ts"]
          }`,
        },
        { name: 'src/index.tsx', content: `import './imported';` },
        { name: 'src/imported.ts', content: 'export default null;' },
        {
          name: 'src/__tests__/imported.test.js',
          content: `import proxy from '../setupProxy'`,
        },
        { name: 'src/setupProxy.js', content: '' },
        { name: 'src/setupTests.js', content: '' },
        { name: 'node_module/module/lib.js', content: '' },
        { name: 'src/global.d.ts', content: '' },
      ],
      exitCode: 0,
      stdout: /There don't seem to be any unimported files./s,
    },
  ],
);

// ----------------------------------------------------------------------------

cases(
  'cli integration tests with update option',
  async (scenario) => {
    const testProjectDir = await createProject(scenario.files);
    const outputFile = path.join(testProjectDir, '.unimportedrc.json');

    try {
      const { exitCode } = await exec(testProjectDir, { update: true });

      const outputFileContent = JSON.parse(await readFile(outputFile, 'utf-8'));
      expect(scenario.output).toEqual(outputFileContent);
      expect(exitCode).toBe(scenario.exitCode);
    } finally {
      await rmdir(testProjectDir, { recursive: true });
    }
  },
  [
    {
      name: 'should identify unimported file',
      files: [
        { name: 'package.json', content: '{ "main": "index.js" }' },
        { name: 'index.js', content: `import foo from './foo';` },
        { name: 'foo.js', content: '' },
        { name: 'bar.js', content: '' },
      ],
      exitCode: 0,
      output: {
        ignoreUnresolved: [],
        ignoreUnimported: ['bar.js'],
        ignoreUnused: [],
      },
    },
    {
      name: 'should identify unused dependencies',
      files: [
        {
          name: 'package.json',
          content:
            '{ "main": "index.js", "dependencies": { "@test/dependency": "1.0.0" } }',
        },
        { name: 'index.js', content: `import foo from './foo';` },
        { name: 'foo.js', content: '' },
      ],
      exitCode: 0,
      output: {
        ignoreUnresolved: [],
        ignoreUnimported: [],
        ignoreUnused: ['@test/dependency'],
      },
    },
    {
      name: 'should not ignore anything when everything is used',
      files: [
        {
          name: 'package.json',
          content:
            '{ "main": "index.js", "dependencies": { "@test/dependency": "1.0.0" } }',
        },
        {
          name: 'index.js',
          content: `
import foo from './foo';
import bar from './bar';
`,
        },
        { name: 'foo.js', content: '' },
        { name: 'bar.js', content: 'import test from "@test/dependency"' },
      ],
      exitCode: 0,
      output: {
        ignoreUnresolved: [],
        ignoreUnimported: [],
        ignoreUnused: [],
      },
    },
  ],
);

// ----------------------------------------------------------------------------

cases(
  'cli integration tests with init option',
  async (scenario) => {
    const testProjectDir = await createProject(scenario.files);
    const outputFile = path.join(testProjectDir, '.unimportedrc.json');

    try {
      const { exitCode } = await exec(testProjectDir, { init: true });

      const outputFileContent = JSON.parse(await readFile(outputFile, 'utf-8'));
      expect(scenario.output).toEqual(outputFileContent);
      expect(exitCode).toBe(scenario.exitCode);
    } finally {
      await rmdir(testProjectDir, { recursive: true });
    }
  },
  [
    {
      name: 'should create default ignore file',
      files: [],
      exitCode: 0,
      output: {
        ignorePatterns: [
          '**/node_modules/**',
          '**/*.stories.{js,jsx,ts,tsx}',
          '**/*.tests.{js,jsx,ts,tsx}',
          '**/*.test.{js,jsx,ts,tsx}',
          '**/*.spec.{js,jsx,ts,tsx}',
          '**/tests/**',
          '**/__tests__/**',
          '**/*.d.ts',
        ],
        ignoreUnresolved: [],
        ignoreUnimported: [],
        ignoreUnused: [],
      },
    },
    {
      name: 'should create expected ignore file for meteor project',
      files: [
        {
          name: '.meteor',
          content: '',
        },
      ],
      exitCode: 0,
      output: {
        ignorePatterns: [
          '**/node_modules/**',
          '**/*.stories.{js,jsx,ts,tsx}',
          '**/*.tests.{js,jsx,ts,tsx}',
          '**/*.test.{js,jsx,ts,tsx}',
          '**/*.spec.{js,jsx,ts,tsx}',
          '**/tests/**',
          '**/__tests__/**',
          '**/*.d.ts',
          'packages/**',
          'public/**',
          'private/**',
          'tests/**',
        ],
        ignoreUnresolved: [],
        ignoreUnimported: [],
        ignoreUnused: [],
      },
    },
  ],
);

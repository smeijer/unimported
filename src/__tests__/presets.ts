import { __clearCachedConfig, getConfig } from '../config';
import { runWithFiles } from '../__utils__';
import { purgeCache } from '../cache';

beforeEach(() => {
  __clearCachedConfig();
  purgeCache();
});

test('can identify nextjs projects', async () => {
  const config = await runWithFiles(
    {
      'package.json': { dependencies: { next: '1' } },
      'pages/index.js': '',
    },
    getConfig,
  );

  expect(config.preset).toEqual('next');
  expect(config.entryFiles).toMatchPartial([{ file: './pages/index.js' }]);
});

test('can identify nextjs projects with src folder', async () => {
  const config = await runWithFiles(
    {
      'package.json': { dependencies: { next: '1' } },
      'src/pages/index.js': '',
    },
    getConfig,
  );

  expect(config.preset).toEqual('next');
  expect(config.entryFiles).toMatchPartial([{ file: './src/pages/index.js' }]);
});

test('can identify react-native projects', async () => {
  const config = await runWithFiles(
    {
      'package.json': { dependencies: { 'react-native': '1' } },
      'index.js': '',
    },
    getConfig,
  );

  expect(config.preset).toEqual('react-native');
  expect(config.entryFiles).toMatchPartial([
    { file: 'index.js', label: 'android' },
    { file: 'index.js', label: 'ios' },
  ]);
});

test('can identify react-native platform specific entry points', async () => {
  const config = await runWithFiles(
    {
      'package.json': { dependencies: { 'react-native': '1' } },
      'index.ios.js': '',
      'index.android.js': '',
    },
    getConfig,
  );

  expect(config.preset).toEqual('react-native');
  expect(config.entryFiles).toMatchPartial([
    { file: 'index.android.js', label: 'android' },
    { file: 'index.ios.js', label: 'ios' },
  ]);
});

test('can identify react-native with single build target', async () => {
  const config = await runWithFiles(
    {
      'package.json': { dependencies: { 'react-native': '1' } },
      'index.android.js': '',
    },
    getConfig,
  );

  expect(config.preset).toEqual('react-native');
  expect(config.entryFiles).toMatchPartial([
    { file: 'index.android.js', label: 'android' },
  ]);
});

test('can identify meteor projects', async () => {
  const config = await runWithFiles(
    {
      'package.json': {
        meteor: {
          mainModule: {
            client: './client/index.js',
            server: './server/index.js',
          },
        },
      },
      'client/index.js': '',
      'server/index.js': '',
    },
    getConfig,
  );

  expect(config.preset).toEqual('meteor');
  expect(config.entryFiles).toMatchPartial([
    { file: './client/index.js' },
    { file: './server/index.js' },
  ]);
});

test('can identify meteor projects with single entry point', async () => {
  const config = await runWithFiles(
    {
      'package.json': {
        meteor: {
          mainModule: {
            client: './client/index.js',
          },
        },
      },
      'client/index.js': '',
    },
    getConfig,
  );

  expect(config.preset).toEqual('meteor');
  expect(config.entryFiles).toMatchPartial([{ file: './client/index.js' }]);
});

test('can identify vue projects', async () => {
  const config = await runWithFiles(
    {
      'package.json': { dependencies: { vue: '1' } },
      'index.js': '',
    },
    getConfig,
  );

  expect(config.preset).toEqual('vue');
  expect(config.extensions).toEqual(expect.arrayContaining(['.vue']));
});

test('can identify node projects', async () => {
  const config = await runWithFiles(
    {
      'package.json': {},
      'index.js': '',
    },
    getConfig,
  );
  expect(config.preset).toEqual('node');
});

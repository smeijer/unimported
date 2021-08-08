import fs from 'fs';
import path from 'path';
import { exists, readText, writeText, readJson, writeJson, list } from '../fs';

const testSpaceDir = '.test-space/fs-test';

beforeEach(() => {
  fs.mkdirSync(testSpaceDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(testSpaceDir, { recursive: true });
});

test('should check if file exists', async () => {
  const testFileName = path.join(testSpaceDir, 'testFile.txt');
  await writeText(testFileName, '');

  const fileExists = await exists(testFileName);

  expect(fileExists).toBeTruthy();
});

test('should check if file exists in cwd', async () => {
  const testFileName = 'testFile.txt';
  await writeText(testFileName, '', testSpaceDir);

  const fileExists = await exists(testFileName, testSpaceDir);

  expect(fileExists).toBeTruthy();
});

test('should check if file does not exists', async () => {
  const testFileName = path.join(testSpaceDir, 'missing', 'testFile.txt');

  const fileExists = await exists(testFileName);

  expect(fileExists).toBeFalsy();
});

test('should read text from file', async () => {
  const testFileName = path.join(testSpaceDir, 'testFile.txt');
  const expectedText = 'READ ME!';
  await writeText(testFileName, expectedText);

  const actualText = await readText(testFileName);

  expect(actualText).toBe(expectedText);
});

test('should read text from file in cwd', async () => {
  const testFileName = 'testFile.txt';
  const expectedText = 'READ ME!';
  await writeText(testFileName, expectedText, testSpaceDir);

  const actualText = await readText(testFileName, testSpaceDir);

  expect(actualText).toBe(expectedText);
});

test('should gracefully fail to read text from file', async () => {
  const testFileName = path.join(testSpaceDir, 'missing', 'testFile.txt');
  const expectedText = '';

  const actualText = await readText(testFileName, testSpaceDir);

  expect(actualText).toBe(expectedText);
});

test('should gracefully fail to write text to file', async () => {
  const testFileName = path.join(testSpaceDir, 'missing', 'testFile.txt');
  const expectedText = 'READ ME!';

  await expect(writeText(testFileName, expectedText)).resolves.toBe(undefined);
});

test('should read json from file', async () => {
  const testFileName = path.join(testSpaceDir, 'testFile.txt');
  const expectedJson = { text: 'READ ME!' };
  await writeJson(testFileName, expectedJson);

  const actualJson = await readJson(testFileName);

  expect(actualJson).toEqual(expectedJson);
});

test('should read json from file in cwd', async () => {
  const testFileName = 'testFile.txt';
  const expectedJson = { text: 'READ ME!' };
  await writeJson(testFileName, expectedJson, testSpaceDir);

  const actualJson = await readJson(testFileName, testSpaceDir);

  expect(actualJson).toEqual(expectedJson);
});

test('should handle comments, unquoted props and trailing commas in json files', async () => {
  const testFileName = 'testFile.txt';
  const expectedJson = { json: 'prop' };
  await writeText(
    testFileName,
    `
    { 
      // note the trailing comma?
      json: 'prop',
    }`,
    testSpaceDir,
  );

  const actualJson = await readJson(testFileName, testSpaceDir);
  expect(actualJson).toEqual(expectedJson);
});

test('should gracefully fail to read json from file', async () => {
  const testFileName = path.join(testSpaceDir, 'missing', 'testFile.txt');
  const expectedJson = undefined;

  const actualJson = await readJson(testFileName, testSpaceDir);

  expect(actualJson).toEqual(expectedJson);
});

test('should gracefully fail to write json to file', async () => {
  const testFileName = path.join(testSpaceDir, 'missing', 'testFile.txt');
  const expectedJson = { text: 'READ ME!' };

  await expect(writeJson(testFileName, expectedJson)).resolves.toBe(undefined);
});

test('should list files', async () => {
  await writeText(path.join(testSpaceDir, 'testFile1.txt'), '');
  await writeText(path.join(testSpaceDir, 'testFile2.txt'), '');
  await writeText(path.join(testSpaceDir, 'testFile3.txt'), '');

  const files = await list('**/*', testSpaceDir);

  const cleanedFiles = files.map((file) =>
    file.replace(path.resolve(testSpaceDir), '.').replace(/\\/g, '/'),
  );

  expect(cleanedFiles).toEqual([
    './testFile1.txt',
    './testFile2.txt',
    './testFile3.txt',
  ]);
});

test('should list files matching pattern', async () => {
  await writeText(path.join(testSpaceDir, 'testFile1.txt'), '');
  await writeText(path.join(testSpaceDir, 'ignored.txt'), '');
  await writeText(path.join(testSpaceDir, 'testFile2.txt'), '');

  const files = await list('**/testFile*', testSpaceDir);

  const cleanedFiles = files.map((file) =>
    file.replace(path.resolve(testSpaceDir), '.').replace(/\\/g, '/'),
  );

  expect(cleanedFiles).toEqual(['./testFile1.txt', './testFile2.txt']);
});

test('should list files matching extensions', async () => {
  await writeText(path.join(testSpaceDir, 'testFile1.txt'), '');
  await writeText(path.join(testSpaceDir, 'ignored.sh'), '');
  await writeText(path.join(testSpaceDir, 'testFile2.js'), '');

  const files = await list('**/*', testSpaceDir, { extensions: ['txt', 'js'] });

  const cleanedFiles = files.map((file) =>
    file.replace(path.resolve(testSpaceDir), '.').replace(/\\/g, '/'),
  );

  expect(cleanedFiles).toEqual(['./testFile1.txt', './testFile2.js']);
});

test('should list files matching single extension', async () => {
  await writeText(path.join(testSpaceDir, 'testFile1.txt'), '');
  await writeText(path.join(testSpaceDir, 'ignored.sh'), '');
  await writeText(path.join(testSpaceDir, 'testFile2.js'), '');

  const files = await list('**/*', testSpaceDir, { extensions: ['js'] });

  const cleanedFiles = files.map((file) =>
    file.replace(path.resolve(testSpaceDir), '.').replace(/\\/g, '/'),
  );

  expect(cleanedFiles).toEqual(['./testFile2.js']);
});

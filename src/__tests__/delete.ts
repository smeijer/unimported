import fs from 'fs';
import { removeUnused } from '../delete';
import { ProcessedResult } from '../process';
import { Context, PackageJson } from '../index';
import { readJson, writeText } from '../fs';

const testSpaceDir = '.test-space/delete-test';

beforeEach(() => {
  fs.mkdirSync(testSpaceDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(testSpaceDir, { recursive: true });
});

describe('removeUnused', () => {
  const testFileName1 = 'testFile1.txt';
  const testFileName2 = 'testFile2.txt';
  const unusedFiles = [testFileName1, testFileName2];
  const packageJson: PackageJson = {
    name: '',
    version: '',
    dependencies: {
      'unused-package': '1.0.0',
      'used-package': '1.0.0',
    },
  };
  const result: ProcessedResult = {
    clean: false,
    unimported: unusedFiles,
    unresolved: [],
    unused: ['unused-package'],
  };
  const context = {
    cwd: testSpaceDir,
  } as Context;
  beforeEach(async () => {
    await writeText('package.json', JSON.stringify(packageJson), testSpaceDir);
    await writeText(testFileName1, '', testSpaceDir);
    await writeText(testFileName2, '', testSpaceDir);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('should remove unused packages from package.json', async () => {
    const { removedDeps, error } = await removeUnused(result, context);
    expect(error).toBeUndefined();
    const updatedPackageJson = await readJson<PackageJson>(
      'package.json',
      testSpaceDir,
    );
    expect(removedDeps).toEqual(result.unused);
    expect(updatedPackageJson?.dependencies).toEqual({
      'used-package': '1.0.0',
    });
  });
  it('should remove unused files', async () => {
    const rm = jest.spyOn(fs, 'rm');

    const { deletedFiles } = await removeUnused(result, context);

    expect(rm).toHaveBeenCalledTimes(unusedFiles.length);
    unusedFiles.forEach((file) => {
      expect(rm).toHaveBeenCalledWith(
        `${testSpaceDir}/${file}`,
        expect.any(Function),
      );
    });
    expect(deletedFiles).toEqual(unusedFiles);
  });
  it('should not remove anything if there are unresolved imports', async () => {
    const rm = jest.spyOn(fs, 'rm');

    const { removedDeps, deletedFiles, error } = await removeUnused(
      { ...result, unresolved: ['unused-package'] },
      context,
    );

    expect(error).toContain('Unable to safely');
    expect(removedDeps).toEqual([]);
    expect(deletedFiles).toEqual([]);
    expect(rm).toHaveBeenCalledTimes(0);
    const updatedPackageJson = await readJson<PackageJson>(
      'package.json',
      testSpaceDir,
    );
    expect(updatedPackageJson?.dependencies).toEqual({
      'unused-package': '1.0.0',
      'used-package': '1.0.0',
    });
  });
  it('should not remove anything if package.json is missing', async () => {
    fs.rmSync(`${testSpaceDir}/package.json`);
    const rm = jest.spyOn(fs, 'rm');

    const { removedDeps, deletedFiles, error } = await removeUnused(
      result,
      context,
    );

    expect(error).toContain('Unable to read');
    expect(removedDeps).toEqual([]);
    expect(deletedFiles).toEqual([]);
    expect(rm).toHaveBeenCalledTimes(0);
  });
  it('should handle package.json without dependencies array', async () => {
    const packageJson = { name: '', version: '' };
    await writeText('package.json', JSON.stringify(packageJson), testSpaceDir);
    const rm = jest.spyOn(fs, 'rm');

    const { removedDeps, deletedFiles, error } = await removeUnused(
      result,
      context,
    );

    expect(error).toBe(undefined);
    expect(removedDeps).toEqual([]);
    expect(deletedFiles).toEqual(['testFile1.txt', 'testFile2.txt']);
    expect(rm).toHaveBeenCalledTimes(2);
  });
});

import fs from 'fs';
import { deleteUnimportedFiles, removeUnusedDeps } from '../delete';
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

describe('removeUnusedDeps', () => {
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
    unimported: [],
    unresolved: [],
    unused: ['unused-package'],
  };
  beforeEach(async () => {
    await writeText('package.json', JSON.stringify(packageJson), testSpaceDir);
  });

  it('should remove unused packages from package.json', async () => {
    const context = {
      cwd: testSpaceDir,
    } as Context;
    const { removedDeps, error } = await removeUnusedDeps(result, context);
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
  it('does not remove packages if there are unresolved imports', async () => {
    const context = {
      cwd: testSpaceDir,
    } as Context;
    const { removedDeps, error } = await removeUnusedDeps(
      { ...result, unresolved: ['anything.txt'] },
      context,
    );
    expect(error).toContain('Unable to safely delete');
    expect(removedDeps).toEqual([]);
    const updatedPackageJson = await readJson<PackageJson>(
      'package.json',
      testSpaceDir,
    );
    expect(updatedPackageJson?.dependencies).toEqual({
      'unused-package': '1.0.0',
      'used-package': '1.0.0',
    });
  });
});

describe('deleteUnimportedFiles', () => {
  const testFileName1 = 'testFile1.txt';
  const testFileName2 = 'testFile2.txt';
  const unusedFiles = [testFileName1, testFileName2];
  const result: ProcessedResult = {
    clean: false,
    unimported: unusedFiles,
    unresolved: [],
    unused: [],
  };

  const context = {
    cwd: testSpaceDir,
  } as Context;

  beforeEach(async () => {
    await writeText(testFileName1, '', testSpaceDir);
    await writeText(testFileName2, '', testSpaceDir);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('should call fs.rm for each unused file', async () => {
    const rm = jest.spyOn(fs, 'rm');

    const { deletedFiles } = await deleteUnimportedFiles(result, context);

    expect(rm).toHaveBeenCalledTimes(unusedFiles.length);
    unusedFiles.forEach((file) => {
      expect(rm).toHaveBeenCalledWith(
        `${testSpaceDir}/${file}`,
        expect.any(Function),
      );
    });
    expect(deletedFiles).toEqual(unusedFiles);
  });
  it('does not delete files if there are unresolved imports', async () => {
    const rm = jest.spyOn(fs, 'rm');

    const { deletedFiles, error } = await deleteUnimportedFiles(
      { ...result, unresolved: ['somefile.txt'] },
      context,
    );

    expect(deletedFiles.length).toBe(0);
    expect(rm).toHaveBeenCalledTimes(0);
    expect(error).toContain('Unable to safely delete files');
  });
});

import fs from 'fs';
import { deleteUnimportedFiles } from '../delete';
import { ProcessedResult } from '../process';
import { Context } from '../index';
import { writeText } from '../fs';

const testSpaceDir = '.test-space/delete-test';

beforeEach(() => {
  fs.mkdirSync(testSpaceDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(testSpaceDir, { recursive: true });
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

    const { numFilesDeleted } = await deleteUnimportedFiles(result, context);

    expect(rm).toHaveBeenCalledTimes(unusedFiles.length);
    unusedFiles.forEach((file) => {
      expect(rm).toHaveBeenCalledWith(
        `${testSpaceDir}/${file}`,
        expect.any(Function),
      );
    });
    expect(numFilesDeleted).toBe(unusedFiles.length);
  });
  it('does not delete files if there are unresolved imports', async () => {
    const rm = jest.spyOn(fs, 'rm');

    const { numFilesDeleted, error } = await deleteUnimportedFiles(
      { ...result, unresolved: ['somefile.txt'] },
      context,
    );

    expect(numFilesDeleted).toBe(0);
    expect(rm).toHaveBeenCalledTimes(0);
    expect(error).toContain('Unable to safely delete files');
  });
});

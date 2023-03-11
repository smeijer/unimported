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
  it('should call fs.rm for each unused file', async () => {
    const testFileName1 = 'testFile1.txt';
    const testFileName2 = 'testFile2.txt';
    await writeText(testFileName1, '', testSpaceDir);
    await writeText(testFileName2, '', testSpaceDir);
    const unusedFiles = [testFileName1, testFileName2];

    const result: ProcessedResult = {
      clean: false,
      unimported: unusedFiles,
      unresolved: [],
      unused: [],
    };
    const expectedContext = {
      cwd: testSpaceDir,
    } as Context;

    const rm = jest.spyOn(fs, 'rm');
    const { numFilesDeleted } = await deleteUnimportedFiles(
      result,
      expectedContext,
    );
    expect(rm).toHaveBeenCalledTimes(unusedFiles.length);
    unusedFiles.forEach((file) => {
      expect(rm).toHaveBeenCalledWith(
        `${testSpaceDir}/${file}`,
        expect.any(Function),
      );
    });
    expect(numFilesDeleted).toBe(unusedFiles.length);
  });
});

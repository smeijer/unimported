import { ProcessedResult } from './process';
import { Context } from './index';
import { deleteFile } from './fs';

export async function deleteUnimportedFiles(
  result: ProcessedResult,
  context: Context,
): Promise<{ numFilesDeleted: number }> {
  await Promise.all(
    result.unimported.map((file) => deleteFile(file, context.cwd)),
  );
  return { numFilesDeleted: result.unimported.length };
}

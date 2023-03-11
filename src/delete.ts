import { ProcessedResult } from './process';
import { Context } from './index';
import { deleteFile } from './fs';

export async function deleteUnimportedFiles(
  result: ProcessedResult,
  context: Context,
): Promise<{ numFilesDeleted: number; error?: string }> {
  const deleteIsSafe = result.unresolved.length === 0;
  if (!deleteIsSafe) {
    return {
      numFilesDeleted: 0,
      error:
        'Unable to safely delete files while there are unresolved imports.',
    };
  }
  await Promise.all(
    result.unimported.map((file) => deleteFile(file, context.cwd)),
  );
  return { numFilesDeleted: result.unimported.length };
}

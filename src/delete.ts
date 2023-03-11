import { ProcessedResult } from './process';
import { Context, PackageJson } from './index';
import { deleteFile } from './fs';
import * as fs from './fs';

export async function removeUnusedFiles(
  result: ProcessedResult,
  context: Context,
): Promise<{ deletedFiles: string[]; error?: string }> {
  const deleteIsSafe = result.unresolved.length === 0;
  if (!deleteIsSafe) {
    return {
      deletedFiles: [],
      error:
        'Unable to safely delete files while there are unresolved imports.',
    };
  }
  await Promise.all(
    result.unimported.map((file) => deleteFile(file, context.cwd)),
  );
  return { deletedFiles: result.unimported };
}

export async function removeUnusedDeps(
  result: ProcessedResult,
  context: Context,
): Promise<{ removedDeps: string[]; error?: string }> {
  const packageJson = await fs.readJson<PackageJson>(
    'package.json',
    context.cwd,
  );
  if (!packageJson) {
    return { error: 'Unable to read package.json', removedDeps: [] };
  }
  const deleteIsSafe = result.unresolved.length === 0;
  if (!deleteIsSafe) {
    return {
      removedDeps: [],
      error:
        'Unable to safely delete files while there are unresolved imports.',
    };
  }
  if (!packageJson.dependencies) {
    return { removedDeps: [] };
  }
  const updatedDependencies = Object.fromEntries(
    Object.entries(packageJson.dependencies).filter(
      ([key]) => !result.unused.includes(key),
    ),
  );
  const updatedPackageJson: PackageJson = {
    ...packageJson,
    dependencies: updatedDependencies,
  };
  await fs.writeJson('package.json', updatedPackageJson, context.cwd);
  return { removedDeps: result.unused };
}

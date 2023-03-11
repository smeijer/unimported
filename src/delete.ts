import { ProcessedResult } from './process';
import { Context, PackageJson } from './index';
import { deleteFile } from './fs';
import * as fs from './fs';

export type DeleteResult = {
  deletedFiles: string[];
  removedDeps: string[];
  error?: string;
};

export async function removeUnused(
  result: ProcessedResult,
  context: Context,
): Promise<DeleteResult> {
  const deleteIsSafe = result.unresolved.length === 0;
  if (!deleteIsSafe) {
    return {
      removedDeps: [],
      deletedFiles: [],
      error:
        'Unable to safely remove files and packages while there are unresolved imports.',
    };
  }

  const { removedDeps, error: depsError } = await removeUnusedDeps(
    result,
    context,
  );
  if (depsError) {
    return { removedDeps, deletedFiles: [], error: depsError };
  }
  const { deletedFiles, error: fileError } = await removeUnusedFiles(
    result,
    context,
  );
  return { deletedFiles, removedDeps, error: fileError || depsError };
}

async function removeUnusedFiles(
  result: ProcessedResult,
  context: Context,
): Promise<{ deletedFiles: string[]; error?: string }> {
  await Promise.all(
    result.unimported.map((file) => deleteFile(file, context.cwd)),
  );
  return { deletedFiles: result.unimported };
}

async function removeUnusedDeps(
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

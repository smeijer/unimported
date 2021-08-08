import path from 'path';
import fs from 'fs';
import { mkdir, writeFile } from 'fs/promises';

export async function createTestProject(
  files: Array<{ name: string; content: string }> | Record<string, unknown>,
  baseDir = '.',
  name?: string,
): Promise<string> {
  const randomId = Math.floor(Math.random() * 1000000);

  const testSpaceDir = path.join('.test-space', randomId.toString());

  await mkdir(testSpaceDir, { recursive: true });

  if (name) {
    fs.writeFileSync(path.join(testSpaceDir, '.scenario'), name);
  }

  const fileArray = Array.isArray(files)
    ? files
    : Object.keys(files).map((file) => ({
        name: file,
        content:
          typeof files[file] === 'string'
            ? (files[file] as string)
            : JSON.stringify(files[file]),
      }));

  await Promise.all(
    fileArray.map((file) =>
      mkdir(path.join(testSpaceDir, path.dirname(file.name)), {
        recursive: true,
      }),
    ),
  );

  await Promise.all(
    fileArray.map((file) =>
      writeFile(path.join(testSpaceDir, file.name), file.content),
    ),
  );

  return path.join(testSpaceDir, baseDir);
}

type UnboxPromise<T extends Promise<any>> = T extends Promise<infer U>
  ? U
  : never;

export async function runWithFiles<T extends (...args: any) => any>(
  files: Record<string, unknown>,
  cb: T,
): Promise<UnboxPromise<ReturnType<T>>> {
  const originalCwd = process.cwd();
  let testPath;

  try {
    testPath = await createTestProject(files);
    process.chdir(testPath);
    return await cb();
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(testPath, { recursive: true, force: true });
  }
}

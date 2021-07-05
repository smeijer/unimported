import fileEntryCache, { FileDescriptor } from 'file-entry-cache';

type CacheMeta<T> = FileDescriptor['meta'] & { data: T };

const cache = fileEntryCache.create('unimported', './node_modules/.cache/');

export async function resolveEntry<T>(
  path: string,
  generator: () => Promise<T>,
): Promise<T> {
  const cacheEntry = cache.getFileDescriptor(path);
  const meta: CacheMeta<T> = cacheEntry.meta as CacheMeta<T>;

  if (cacheEntry.changed || !meta?.data) {
    meta.data = await generator();
  }

  return meta.data;
}

export function invalidateEntry(path: string): void {
  cache.removeEntry(path);
}

export function storeCache(): void {
  cache.reconcile();
}

export function purgeCache(): void {
  cache.deleteCacheFile();
}

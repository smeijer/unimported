import fileEntryCache, { FileDescriptor } from 'file-entry-cache';
import { Cache } from 'flat-cache';

type CacheMeta<T> = FileDescriptor['meta'] & { data: T };

const cache = fileEntryCache.create('unimported', './node_modules/.cache/');

export class InvalidCacheError extends Error {
  path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = 'InvalidCacheError';
    this.path = path;
  }
}

export async function resolveEntry<T>(
  path: string,
  generator: () => Promise<T>,
): Promise<T> {
  const cacheEntry = cache.getFileDescriptor(path);
  const meta: CacheMeta<T> = cacheEntry.meta as CacheMeta<T>;

  if (!meta) {
    // Something else referenced a now deleted file. Force error and let upstream handle
    throw new InvalidCacheError(`${path} was deleted`, path);
  }

  if (cacheEntry.changed || !meta.data) {
    meta.data = await generator();
  }

  return meta.data;
}

export function invalidateEntry(path: string): void {
  cache.removeEntry(path);
}

export function invalidateEntries<T>(shouldRemove: (meta: T) => boolean): void {
  Object.values((cache.cache as Cache).all()).forEach((cacheEntry) => {
    if (shouldRemove(cacheEntry.data as T)) {
      cache.removeEntry(cacheEntry.data.path);
    }
  });
}

export function storeCache(): void {
  cache.reconcile();
}

export function purgeCache(): void {
  cache.deleteCacheFile();
}

import fileEntryCache, {
  FileDescriptor,
  FileEntryCache,
} from 'file-entry-cache';
import { Cache } from 'flat-cache';
import { log } from './log';
import path from 'path';
import { rmSync } from 'fs';
import { EntryConfig } from './config';

type CacheMeta<T> = FileDescriptor['meta'] & { data: T };

// we keep cache groups per entry file, to keep the cache free from override conflicts
const caches: Record<string, FileEntryCache> = {};

export function getCacheIdentity(entry: EntryConfig): string {
  // don't use just the file name, the entry file can be the same, while the
  // overrides make it build target specific.
  const value = JSON.stringify({
    ...entry,
    filepath: path.resolve(entry.file),
  });

  return hash(value);
}

function getCache(identity: string) {
  if (caches[identity]) {
    return caches[identity];
  }

  caches[identity] = fileEntryCache.create(
    identity,
    path.resolve(process.cwd(), './node_modules/.cache/unimported'),
  );

  return caches[identity];
}

// Create short hashes for file names
function hash(path: string): string {
  let h;
  let i;

  for (h = 0, i = 0; i < path.length; h &= h) {
    h = 31 * h + path.charCodeAt(i++);
  }

  return Math.abs(h).toString(16);
}

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
  cacheIdentity = '*',
): Promise<T> {
  const cacheEntry = getCache(cacheIdentity).getFileDescriptor(path);
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
  for (const cache of Object.values(caches)) {
    cache.removeEntry(path);
  }
}

export function invalidateEntries<T>(shouldRemove: (meta: T) => boolean): void {
  for (const cache of Object.values(caches)) {
    Object.values((cache.cache as Cache).all()).forEach((cacheEntry) => {
      if (shouldRemove(cacheEntry.data as T)) {
        cache.removeEntry(cacheEntry.data.path);
      }
    });
  }
}

export function storeCache(): void {
  log.info('store cache');

  for (const key of Object.keys(caches)) {
    caches[key].reconcile();
  }
}

export function purgeCache(): void {
  log.info('purge cache');

  rmSync(path.resolve(process.cwd(), './node_modules/.cache/unimported'), {
    recursive: true,
    force: true,
  });
}

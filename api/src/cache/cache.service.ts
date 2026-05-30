import { Injectable } from '@nestjs/common';
import * as NodeCache from 'node-cache';

@Injectable()
export class CacheService {
  private readonly cache: NodeCache;

  constructor() {
    // Initialize node-cache instance
    this.cache = new NodeCache({
      useClones: true, // Returns cloned copies to prevent accidental mutations of cached objects
    });
  }

  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  set<T>(key: string, value: T, ttlSeconds: number): boolean {
    return this.cache.set(key, value, ttlSeconds);
  }

  del(key: string): number {
    return this.cache.del(key);
  }

  delPrefix(prefix: string): void {
    const keys = this.cache.keys();
    const keysToDelete = keys.filter((key) => key.startsWith(prefix));
    if (keysToDelete.length > 0) {
      this.cache.del(keysToDelete);
    }
  }

  flush(): void {
    this.cache.flushAll();
  }

  getStats() {
    return this.cache.getStats();
  }
}

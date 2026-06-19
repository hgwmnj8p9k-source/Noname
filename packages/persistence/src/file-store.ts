import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Durable JSON state store backed by a single file. Designed for a persistent
 * volume (e.g. Railway) so the paper account and trade journal survive restarts
 * and redeploys. Writes are atomic (temp file + rename) so a crash mid-write
 * never corrupts the saved state.
 */
export class FileStateStore<T> {
  constructor(private readonly filePath: string) {}

  async load(): Promise<T | null> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      return JSON.parse(raw) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async save(value: T): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await writeFile(tmp, JSON.stringify(value), 'utf8');
    await rename(tmp, this.filePath);
  }
}

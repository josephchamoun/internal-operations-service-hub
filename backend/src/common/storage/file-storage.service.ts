import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Generic JSON-file persistence.
 *
 * There's no real database yet, so each "table" is just a JSON array
 * living in a file under /data. This service knows how to read and
 * write those files safely. Entity-specific repositories (like
 * RequestsRepository) sit on top of this and don't need to know
 * anything about the filesystem.
 */
@Injectable()
export class FileStorageService {
  private readonly dataDir = path.join(process.cwd(), 'data');

  /** Reads the full array stored in `<fileName>`. Creates an empty file if missing. */
  async readAll<T>(fileName: string): Promise<T[]> {
    const filePath = this.resolvePath(fileName);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return raw.trim().length ? (JSON.parse(raw) as T[]) : [];
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        await this.writeAll(fileName, []);
        return [];
      }
      throw err;
    }
  }

  /** Overwrites `<fileName>` with the given array, pretty-printed. */
  async writeAll<T>(fileName: string, data: T[]): Promise<void> {
    const filePath = this.resolvePath(fileName);
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  private resolvePath(fileName: string): string {
    return path.join(this.dataDir, fileName);
  }
}

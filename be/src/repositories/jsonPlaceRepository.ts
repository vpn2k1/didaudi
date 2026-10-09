import { readFile, rename, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { placeRecordSchema, type PlaceRecord } from '../domain/schemas.js';
import { InMemoryPlaceRepository } from './placeRepository.js';

/**
 * Lưu vào 1 file JSON. Chỉ phù hợp chạy local/1 instance có ổ đĩa bền vững
 * (không dùng được trên serverless như Vercel Functions).
 */
export class JsonPlaceRepository extends InMemoryPlaceRepository {
  private writing: Promise<void> = Promise.resolve();

  private constructor(
    private readonly file: string,
    seed: PlaceRecord[],
  ) {
    super(seed);
  }

  static async open(file: string): Promise<JsonPlaceRepository> {
    const raw = JSON.parse(await readFile(file, 'utf8'));
    const items = z.array(placeRecordSchema).parse(raw);
    return new JsonPlaceRepository(file, items);
  }

  // Ghi tuần tự + ghi ra file tạm rồi rename để không làm hỏng file khi đang ghi
  protected override persist(): Promise<void> {
    const data = JSON.stringify(this.items, null, 2) + '\n';
    this.writing = this.writing.then(async () => {
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, data);
      await rename(tmp, this.file);
    });
    return this.writing;
  }
}

import type { PlaceRecord } from '../domain/schemas.js';

/**
 * Nơi lưu địa điểm do đội ngũ tự quản lý.
 * MVP: file JSON. Bước tiếp theo: PostgreSQL + PostGIS (xem db/schema.sql).
 */
export interface PlaceRepository {
  list(): Promise<PlaceRecord[]>;
  findById(id: string): Promise<PlaceRecord | undefined>;
  findBySlug(slug: string): Promise<PlaceRecord | undefined>;
  create(record: PlaceRecord): Promise<PlaceRecord>;
  update(id: string, record: PlaceRecord): Promise<PlaceRecord>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryPlaceRepository implements PlaceRepository {
  protected items: PlaceRecord[];

  constructor(seed: PlaceRecord[] = []) {
    this.items = structuredClone(seed);
  }

  async list() {
    return this.items;
  }
  async findById(id: string) {
    return this.items.find((p) => p.id === id);
  }
  async findBySlug(slug: string) {
    return this.items.find((p) => p.slug === slug);
  }
  async create(record: PlaceRecord) {
    this.items.push(record);
    await this.persist();
    return record;
  }
  async update(id: string, record: PlaceRecord) {
    const i = this.items.findIndex((p) => p.id === id);
    if (i < 0) throw new Error(`Place ${id} not found`);
    this.items[i] = record;
    await this.persist();
    return record;
  }
  async delete(id: string) {
    const before = this.items.length;
    this.items = this.items.filter((p) => p.id !== id);
    if (this.items.length === before) return false;
    await this.persist();
    return true;
  }
  protected async persist(): Promise<void> {}
}

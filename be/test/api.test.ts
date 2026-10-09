import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { LocalPlaceProvider } from '../src/providers/localPlaceProvider.js';
import { InMemoryPlaceRepository } from '../src/repositories/placeRepository.js';
import { places, provinces, taxonomy } from './fixtures.js';

const PASSWORD = 'mat-khau-test-123';
function makeApp(env: Record<string, string> = {}) {
  const config = loadConfig({ NODE_ENV: 'test', ...env });
  const repo = new InMemoryPlaceRepository(places);
  const provider = new LocalPlaceProvider(repo, () => ({ provinces, taxonomy }));
  return { app: createApp({ config, provider, repo, provinces, taxonomy, log: () => {} }), repo };
}
const adminEnv = { ADMIN_PASSWORD: PASSWORD, ADMIN_SESSION_SECRET: 'x'.repeat(40) };

describe('public API', () => {
  const { app } = makeApp();

  it('search + validation', async () => {
    const ok = await request(app).get('/api/places/search?q=pho');
    expect(ok.status).toBe(200);
    expect(ok.body.provider.id).toBe('local');
    const bad = await request(app).get('/api/places/search?radius=999');
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('VALIDATION');
  });

  it('chi tiết: không lộ trường nội bộ, 404 cho bản nháp', async () => {
    const r = await request(app).get('/api/places/pho-a');
    expect(r.status).toBe(200);
    expect(r.body.place.osmHint).toBeUndefined();
    expect((await request(app).get('/api/places/nhap')).status).toBe(404);
  });

  it('tỉnh/thành có số lượng địa điểm', async () => {
    const r = await request(app).get('/api/provinces');
    expect(r.body.items.find((p: { slug: string }) => p.slug === 'ha-noi').placeCount).toBe(4);
    expect((await request(app).get('/api/provinces/khong-co')).status).toBe(404);
  });

  it('kết quả có tọa độ user thì không cache', async () => {
    const r = await request(app).get('/api/places/search?near=21.03,105.85');
    expect(r.headers['cache-control']).toContain('no-store');
  });
});

describe('gợi ý theo nhu cầu', () => {
  const { app } = makeApp();

  it('plan: validate + trả lịch trình', async () => {
    expect((await request(app).get('/api/plan?intent=date')).status).toBe(400);
    expect((await request(app).get('/api/plan?intent=date&province=khong-co')).status).toBe(404);
    const r = await request(app).get('/api/plan?intent=food&near=21.03,105.85&radius=5');
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toContain('no-store');
    expect(r.body.plan.stops.length).toBeGreaterThan(0);
    expect(r.body.plan.anchor.precision).toBe('coarse');
  });

  it('suggest + photos', async () => {
    const s = await request(app).get('/api/suggest?q=ha%20noi');
    expect(s.body.items[0]).toMatchObject({ type: 'province', provinceSlug: 'ha-noi' });
    expect((await request(app).get('/api/suggest')).status).toBe(400);
    const ph = await request(app).get('/api/photos?slugs=pho-a,nhap');
    expect(ph.status).toBe(200);
    expect(ph.body.photos).toEqual({});
  });
});

describe('admin API', () => {
  it('chưa cấu hình → tắt hoàn toàn', async () => {
    const { app } = makeApp();
    expect((await request(app).get('/api/admin/places')).status).toBe(503);
    expect((await request(app).post('/api/admin/session').set('x-ddvn-admin', '1').send({ password: 'x' })).status).toBe(503);
  });

  it('chặn khi chưa đăng nhập, sai mật khẩu, thiếu header CSRF', async () => {
    const { app } = makeApp(adminEnv);
    expect((await request(app).post('/api/admin/places').set('x-ddvn-admin', '1').send({})).status).toBe(401);
    expect((await request(app).post('/api/admin/session').set('x-ddvn-admin', '1').send({ password: 'sai-mat-khau-roi' })).status).toBe(401);
    expect((await request(app).post('/api/admin/session').send({ password: PASSWORD })).status).toBe(403);
  });

  it('CRUD đầy đủ sau khi đăng nhập', async () => {
    const { app, repo } = makeApp(adminEnv);
    const agent = request.agent(app);
    const login = await agent.post('/api/admin/session').set('x-ddvn-admin', '1').send({ password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']?.[0]).toMatch(/HttpOnly; SameSite=Strict/);

    const input = { name: 'Bún chả Test', category: 'food', provinceSlug: 'ha-noi', latitude: 21.03, longitude: 105.85, tags: ['pho'], publicationStatus: 'draft' };
    // Ghi mà thiếu header CSRF → 403
    expect((await agent.post('/api/admin/places').send(input)).status).toBe(403);

    const created = await agent.post('/api/admin/places').set('x-ddvn-admin', '1').send(input);
    expect(created.status).toBe(201);
    expect(created.body.place.slug).toBe('bun-cha-test');
    const id = created.body.place.id;

    // Bản nháp chưa xuất hiện ở trang công khai
    expect((await request(app).get('/api/places/bun-cha-test')).status).toBe(404);

    const updated = await agent.put(`/api/admin/places/${id}`).set('x-ddvn-admin', '1').send({ ...input, publicationStatus: 'published', priceMin: 30000, priceMax: 50000 });
    expect(updated.status).toBe(200);
    expect((await request(app).get('/api/places/bun-cha-test')).status).toBe(200);

    const invalid = await agent.put(`/api/admin/places/${id}`).set('x-ddvn-admin', '1').send({ ...input, latitude: 99, priceMin: 50000, priceMax: 10000 });
    expect(invalid.status).toBe(400);
    const xss = await agent.put(`/api/admin/places/${id}`).set('x-ddvn-admin', '1').send({ ...input, website: 'javascript:alert(1)' });
    expect(xss.status).toBe(400);
    const badProvince = await agent.post('/api/admin/places').set('x-ddvn-admin', '1').send({ ...input, provinceSlug: 'khong-ton-tai' });
    expect(badProvince.status).toBe(400);

    expect((await agent.delete(`/api/admin/places/${id}`).set('x-ddvn-admin', '1')).status).toBe(204);
    expect(await repo.findById(id)).toBeUndefined();
  });
});

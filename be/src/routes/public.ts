import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { searchQuerySchema, type Photo, type Province } from '../domain/schemas.js';
import type { PlaceProvider } from '../providers/PlaceProvider.js';
import type { PlaceRepository } from '../repositories/placeRepository.js';
import { buildPlan, PlanError, planQuerySchema } from '../services/planner.js';
import { CHEAP_MAX_VND, DEFAULT_RADIUS_KM, type Taxonomy } from '../services/search.js';
import { suggestLocations } from '../services/suggest.js';

const placeSlug = z.string().regex(/^[A-Za-z0-9_-]{2,320}$/);

export function publicRoutes(deps: { provider: PlaceProvider; repo: PlaceRepository; provinces: () => Province[]; taxonomy: () => Taxonomy; photos: Record<string, Photo> }) {
  const r = Router();
  const { provider } = deps;
  // Dữ liệu provider bên ngoài không được cache ở CDN; dữ liệu nội bộ cache ngắn
  const cacheHeader = provider.info.id === 'local' ? 'public, max-age=60' : 'private, no-store';

  r.use(
    '/places',
    rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh, thử lại sau ít phút.' } }),
  );

  r.use(
    ['/plan', '/suggest'],
    rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh, thử lại sau ít phút.' } }),
  );

  // Gợi ý theo nhu cầu – chạy trên dữ liệu nội bộ (provider Google chưa hỗ trợ)
  r.get('/plan', async (req, res, next) => {
    try {
      if (provider.info.id !== 'local') return res.status(501).json({ error: 'NOT_SUPPORTED', message: 'Gợi ý theo nhu cầu chỉ hỗ trợ dữ liệu nội bộ.' });
      const query = planQuerySchema.parse(req.query);
      const plan = buildPlan(await deps.repo.list(), query, { provinces: deps.provinces(), taxonomy: deps.taxonomy(), photos: deps.photos });
      res.set('Cache-Control', 'private, no-store').json({ plan, provider: provider.info });
    } catch (e) {
      if (e instanceof PlanError) return res.status(e.status).json({ error: 'PLAN', message: e.message });
      next(e);
    }
  });

  r.get('/suggest', async (req, res, next) => {
    try {
      const q = z.string().trim().min(1).max(60).parse(req.query.q);
      res.set('Cache-Control', 'public, max-age=60').json({ items: suggestLocations(q, await deps.repo.list(), deps.provinces()) });
    } catch (e) {
      next(e);
    }
  });

  // Ảnh đại diện theo slug (dùng cho thẻ lựa chọn ở trang chủ)
  r.get('/photos', async (req, res, next) => {
    try {
      const slugs = z.string().max(400).parse(req.query.slugs ?? '').split(',').filter(Boolean).slice(0, 20);
      const records = await deps.repo.list();
      const out: Record<string, { url: string; pageUrl: string; author: string; license: string }> = {};
      for (const slug of slugs) {
        const rec = records.find((r) => r.slug === slug && r.publicationStatus === 'published');
        const ph = rec && deps.photos[rec.id];
        if (ph) out[slug] = { url: ph.thumbUrl, pageUrl: ph.pageUrl, author: ph.author, license: ph.license };
      }
      res.set('Cache-Control', 'public, max-age=300').json({ photos: out });
    } catch (e) {
      next(e);
    }
  });

  r.get('/health', (_req, res) => res.json({ ok: true }));

  r.get('/meta', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300').json({
      categories: deps.taxonomy().categories,
      tags: deps.taxonomy().tags,
      provider: provider.info,
      cheapMaxVnd: CHEAP_MAX_VND,
      defaultRadiusKm: DEFAULT_RADIUS_KM,
    });
  });

  r.get('/provinces', async (_req, res, next) => {
    try {
      const counts = await provider.countByProvince();
      const items = deps.provinces().map((p) => {
        const byCategory = counts[p.slug] ?? {};
        return { ...p, placeCount: Object.values(byCategory).reduce((a, b) => a + (b ?? 0), 0), byCategory };
      });
      res.set('Cache-Control', 'public, max-age=300').json({ items });
    } catch (e) {
      next(e);
    }
  });

  r.get('/provinces/:slug', async (req, res, next) => {
    try {
      const p = deps.provinces().find((x) => x.slug === req.params.slug);
      if (!p) return res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy tỉnh/thành' });
      const byCategory = (await provider.countByProvince())[p.slug] ?? {};
      res.set('Cache-Control', 'public, max-age=300').json({ ...p, placeCount: Object.values(byCategory).reduce((a, b) => a + (b ?? 0), 0), byCategory });
    } catch (e) {
      next(e);
    }
  });

  r.get('/provinces/:slug/places', async (req, res, next) => {
    try {
      if (!deps.provinces().some((x) => x.slug === req.params.slug)) return res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy tỉnh/thành' });
      const query = searchQuerySchema.parse({ ...req.query, province: req.params.slug });
      res.set('Cache-Control', cacheHeader).json({ ...(await provider.search(query)), provider: provider.info });
    } catch (e) {
      next(e);
    }
  });

  r.get('/places/search', async (req, res, next) => {
    try {
      const query = searchQuerySchema.parse(req.query);
      res.set('Cache-Control', query.near ? 'private, no-store' : cacheHeader).json({ ...(await provider.search(query)), provider: provider.info });
    } catch (e) {
      next(e);
    }
  });

  r.get('/places/:slug', async (req, res, next) => {
    try {
      const slug = placeSlug.parse(req.params.slug);
      const place = await provider.getBySlug(slug);
      if (!place) return res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy địa điểm' });
      res.set('Cache-Control', cacheHeader).json({ place, provider: provider.info });
    } catch (e) {
      next(e);
    }
  });

  return r;
}

import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  checkPassword,
  clearSessionCookie,
  createSessionToken,
  CSRF_HEADER,
  readCookie,
  requireAdmin,
  sessionCookie,
  verifySessionToken,
  ADMIN_COOKIE,
} from '../auth/adminAuth.js';
import type { Config } from '../config.js';
import { placeInputSchema, type PlaceRecord, type Province } from '../domain/schemas.js';
import { slugify } from '../lib/text.js';
import type { PlaceRepository } from '../repositories/placeRepository.js';
import type { Taxonomy } from '../services/search.js';

class ValidationFailure extends Error {
  constructor(
    message: string,
    readonly field: string,
  ) {
    super(message);
  }
}

export function adminRoutes(deps: { config: Config; repo: PlaceRepository; provinces: () => Province[]; taxonomy: () => Taxonomy }) {
  const r = Router();
  const { config, repo } = deps;
  const secret = config.ADMIN_SESSION_SECRET;
  const secure = config.NODE_ENV === 'production';

  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'RATE_LIMITED', message: 'Đăng nhập sai quá nhiều lần, thử lại sau 15 phút.' },
  });

  r.get('/session', (req, res) => {
    res.set('Cache-Control', 'no-store').json({
      enabled: config.adminEnabled,
      authenticated: config.adminEnabled && !!secret && verifySessionToken(readCookie(req, ADMIN_COOKIE), secret),
    });
  });

  r.post('/session', loginLimiter, (req, res) => {
    if (!config.adminEnabled || !secret || !config.ADMIN_PASSWORD) {
      return res.status(503).json({ error: 'ADMIN_DISABLED', message: 'Trang quản trị chưa được bật.' });
    }
    if (req.get(CSRF_HEADER) !== '1') return res.status(403).json({ error: 'CSRF', message: 'Thiếu header xác thực yêu cầu.' });
    if (!checkPassword(req.body?.password, config.ADMIN_PASSWORD)) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Mật khẩu không đúng.' });
    }
    res.set('Set-Cookie', sessionCookie(createSessionToken(secret), secure)).json({ authenticated: true });
  });

  r.delete('/session', (_req, res) => {
    res.set('Set-Cookie', clearSessionCookie).json({ authenticated: false });
  });

  // Mọi route bên dưới cần đăng nhập
  r.use('/places', requireAdmin({ enabled: config.adminEnabled, secret }));

  r.get('/places', async (_req, res) => {
    const items = (await repo.list())
      .map(({ id, slug, name, category, provinceSlug, publicationStatus, verificationStatus, isDemo, updatedAt }) => ({
        id,
        slug,
        name,
        category,
        provinceSlug,
        publicationStatus,
        verificationStatus,
        isDemo,
        updatedAt,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.set('Cache-Control', 'no-store').json({ items });
  });

  r.get('/places/:id', async (req, res) => {
    const p = await repo.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy địa điểm' });
    res.set('Cache-Control', 'no-store').json({ place: p });
  });

  async function buildRecord(body: unknown, existing?: PlaceRecord): Promise<PlaceRecord> {
    const input = placeInputSchema.parse(body);
    if (!deps.provinces().some((p) => p.slug === input.provinceSlug)) throw new ValidationFailure('Tỉnh/thành không tồn tại', 'provinceSlug');
    const unknownTag = input.tags.find((t) => !(t in deps.taxonomy().tags));
    if (unknownTag) throw new ValidationFailure(`Thẻ không hợp lệ: ${unknownTag}`, 'tags');

    let slug = input.slug ?? existing?.slug ?? slugify(input.name);
    const taken = await repo.findBySlug(slug);
    if (taken && taken.id !== existing?.id) {
      if (input.slug) throw new ValidationFailure('Slug đã được dùng', 'slug');
      slug = `${slug}-${randomUUID().slice(0, 4)}`;
    }
    const now = new Date().toISOString();
    return {
      ...input,
      slug,
      id: existing?.id ?? randomUUID(),
      osmHint: existing?.osmHint ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }

  function handle(fn: (req: Request, res: Response) => Promise<unknown>) {
    return async (req: Request, res: Response, next: (e?: unknown) => void) => {
      try {
        await fn(req, res);
      } catch (e) {
        if (e instanceof ValidationFailure) return res.status(400).json({ error: 'VALIDATION', message: e.message, issues: [{ path: [e.field], message: e.message }] });
        next(e);
      }
    };
  }

  r.post(
    '/places',
    handle(async (req, res) => {
      const record = await buildRecord(req.body);
      res.status(201).json({ place: await repo.create(record) });
    }),
  );

  r.put(
    '/places/:id',
    handle(async (req, res) => {
      const existing = await repo.findById(req.params.id!);
      if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy địa điểm' });
      res.json({ place: await repo.update(existing.id, await buildRecord(req.body, existing)) });
    }),
  );

  r.delete(
    '/places/:id',
    handle(async (req, res) => {
      const ok = await repo.delete(req.params.id!);
      if (!ok) return res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy địa điểm' });
      res.status(204).end();
    }),
  );

  return r;
}

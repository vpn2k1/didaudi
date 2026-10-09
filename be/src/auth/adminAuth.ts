import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const ADMIN_COOKIE = 'ddvn_admin';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
/** Header bắt buộc cho mọi request ghi dữ liệu – trình duyệt không thể gửi header này cross-site mà không qua CORS. */
export const CSRF_HEADER = 'x-ddvn-admin';

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');
const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

function safeEqual(a: string, b: string): boolean {
  // So sánh hash có độ dài cố định để không lộ độ dài/nội dung qua thời gian xử lý
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(input: unknown, expected: string): boolean {
  return typeof input === 'string' && safeEqual(input, expected);
}

export function createSessionToken(secret: string, now = Date.now()): string {
  const payload = b64url(JSON.stringify({ sub: 'admin', exp: now + SESSION_TTL_MS }));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload, secret))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > now;
  } catch {
    return false;
  }
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function sessionCookie(token: string, secure: boolean): string {
  return [
    `${ADMIN_COOKIE}=${token}`,
    'Path=/api/admin',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_TTL_MS / 1000}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export const clearSessionCookie = `${ADMIN_COOKIE}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0`;

export function requireAdmin(opts: { enabled: boolean; secret?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!opts.enabled || !opts.secret) {
      return res.status(503).json({ error: 'ADMIN_DISABLED', message: 'Trang quản trị chưa được bật (thiếu ADMIN_PASSWORD / ADMIN_SESSION_SECRET).' });
    }
    if (!verifySessionToken(readCookie(req, ADMIN_COOKIE), opts.secret)) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Cần đăng nhập quản trị.' });
    }
    if (req.method !== 'GET' && req.get(CSRF_HEADER) !== '1') {
      return res.status(403).json({ error: 'CSRF', message: 'Thiếu header xác thực yêu cầu.' });
    }
    next();
  };
}

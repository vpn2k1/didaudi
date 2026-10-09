import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Tự đọc be/.env nếu có (Node ≥ 20.12). Không bắt buộc – có thể truyền env từ môi trường.
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().default(4000),
    PLACES_PROVIDER: z.enum(['local', 'google']).default('local'),
    GOOGLE_PLACES_API_KEY: z.string().min(10).optional(),
    ADMIN_PASSWORD: z.string().min(12, 'ADMIN_PASSWORD cần ≥ 12 ký tự').optional(),
    ADMIN_SESSION_SECRET: z.string().min(32, 'ADMIN_SESSION_SECRET cần ≥ 32 ký tự').optional(),
    DATA_DIR: z.string().default(fileURLToPath(new URL('../data', import.meta.url))),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  })
  .refine((e) => e.PLACES_PROVIDER !== 'google' || e.GOOGLE_PLACES_API_KEY, {
    message: 'PLACES_PROVIDER=google cần GOOGLE_PLACES_API_KEY',
    path: ['GOOGLE_PLACES_API_KEY'],
  });

export type Config = z.infer<typeof envSchema> & { adminEnabled: boolean };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // Biến rỗng trong .env coi như chưa đặt
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ''));
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${msg}`);
  }
  return { ...parsed.data, adminEnabled: !!(parsed.data.ADMIN_PASSWORD && parsed.data.ADMIN_SESSION_SECRET) };
}

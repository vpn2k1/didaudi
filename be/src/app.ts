import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import type { Config } from './config.js';
import type { Photo, Province } from './domain/schemas.js';
import { ProviderError, type PlaceProvider } from './providers/PlaceProvider.js';
import type { PlaceRepository } from './repositories/placeRepository.js';
import { adminRoutes } from './routes/admin.js';
import { publicRoutes } from './routes/public.js';
import type { Taxonomy } from './services/search.js';

export interface AppDeps {
  config: Config;
  provider: PlaceProvider;
  repo: PlaceRepository;
  provinces: Province[];
  taxonomy: Taxonomy;
  photos?: Record<string, Photo>;
  log?: (line: string) => void;
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  if (deps.config.TRUST_PROXY) app.set('trust proxy', deps.config.TRUST_PROXY);
  app.use(helmet());
  app.use(express.json({ limit: '50kb' }));

  // Log tối giản: KHÔNG ghi query string để không lưu tọa độ người dùng
  const log = deps.log ?? ((line: string) => console.log(line));
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`));
    next();
  });

  const provinces = () => deps.provinces;
  const taxonomy = () => deps.taxonomy;
  app.use('/api', publicRoutes({ provider: deps.provider, repo: deps.repo, provinces, taxonomy, photos: deps.photos ?? {} }));
  app.use('/api/admin', adminRoutes({ config: deps.config, repo: deps.repo, provinces, taxonomy }));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'NOT_FOUND', message: 'Không có endpoint này' }));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Dữ liệu không hợp lệ', issues: err.issues.map((i) => ({ path: i.path, message: i.message })) });
    }
    if (err instanceof ProviderError) return res.status(err.status).json({ error: 'PROVIDER', message: err.message });
    if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'BAD_JSON', message: 'JSON không hợp lệ' });
    console.error(err);
    res.status(500).json({ error: 'INTERNAL', message: 'Lỗi máy chủ, vui lòng thử lại.' });
  });

  return app;
}

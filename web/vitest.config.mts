import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Không nạp postcss.config của Tailwind khi chạy unit test
  css: { postcss: {} },
  test: { include: ['test/**/*.test.ts'] },
});

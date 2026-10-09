import 'server-only';
import { backendUrl } from '@/config/env';
import { serverApi } from './api';
import type { Category } from './types';

export const api = () => serverApi(backendUrl());

const CATEGORIES: Category[] = ['food', 'cafe', 'sight', 'fun'];

/** Đọc ?q=&category= an toàn từ URL. */
export function readExploreQuery(sp: Record<string, string | string[] | undefined>) {
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 100) : undefined;
  const category = typeof sp.category === 'string' && CATEGORIES.includes(sp.category as Category) ? (sp.category as Category) : undefined;
  return { q, category };
}

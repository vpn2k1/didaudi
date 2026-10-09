export type Category = 'sight' | 'food' | 'cafe';

export interface Place {
  id: string;
  name: string;
  category: Category;
  tags: string[];
  address: string;
  area: string;
  lat: number;
  lng: number;
  description: string;
  mustTry?: string;
  price?: 1 | 2 | 3;
  fee?: string;
  verified?: boolean;
  osm?: { type: string; id: number; name: string };
  distanceKm?: number;
}

export interface Meta {
  city: { name: string; center: [number, number] };
  categories: Record<Category, { label: string; icon: string }>;
  tags: Record<string, string>;
  tagsByCategory: Record<Category, string[]>;
}

export interface UserLoc {
  lat: number;
  lng: number;
  source: 'gps' | 'manual' | 'default';
}

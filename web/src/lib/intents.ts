import type { Illustration } from './images';
import type { Intent } from './types';

export type LocationMode = 'gps' | 'province' | 'place';

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

export type Field =
  | { kind: 'location'; key: 'location'; label: string; modes: LocationMode[] }
  | { kind: 'single'; key: string; label: string; options: Option[]; defaultValue?: string; optional?: boolean }
  | { kind: 'multi'; key: string; label: string; options: Option[]; hint?: string };

export interface IntentConfig {
  id: Intent;
  slug: string;
  title: string;
  short: string;
  description: string;
  image: Illustration;
  /** Địa điểm lấy ảnh thật làm ảnh bìa (nếu có ảnh). */
  photoSlug: string;
  /** Màu gradient (Tailwind) phủ lên ảnh. */
  accent: string;
  cta: string;
  fields: Field[];
}

const time: Field = {
  kind: 'single',
  key: 'time',
  label: 'Đi vào lúc nào?',
  options: [
    { value: 'morning', label: 'Buổi sáng' },
    { value: 'afternoon', label: 'Buổi chiều' },
    { value: 'evening', label: 'Buổi tối' },
    { value: 'night', label: 'Đêm khuya' },
  ],
  optional: true,
};

/** Ngân sách mỗi người → mức giá ước tính tối đa (0–4). */
const budgetPerPerson: Field = {
  kind: 'single',
  key: 'budget',
  label: 'Ngân sách mỗi người',
  options: [
    { value: '1', label: 'Dưới 100k' },
    { value: '2', label: '100k – 300k' },
    { value: '3', label: '300k – 700k' },
    { value: '', label: 'Không giới hạn' },
  ],
  defaultValue: '',
};

export const INTENTS: IntentConfig[] = [
  {
    id: 'travel',
    slug: 'du-lich',
    title: 'Du lịch & chụp ảnh',
    short: 'Du lịch',
    description: 'Khu du lịch, góc check-in đẹp – sắp xếp từ gần đến xa.',
    image: 'karst', photoSlug: 'trang-an',
    accent: 'from-red-950/90 via-red-900/50',
    cta: 'Tìm điểm chụp ảnh',
    fields: [
      { kind: 'location', key: 'location', label: 'Xuất phát từ đâu?', modes: ['gps', 'province', 'place'] },
      {
        kind: 'multi',
        key: 'prefs',
        label: 'Bạn thích phong cách nào?',
        hint: 'Bỏ trống = tất cả',
        options: [
          { value: 'thien-nhien', label: '🌿 Thiên nhiên' },
          { value: 'song-ao', label: '📸 Check-in sống ảo' },
          { value: 'van-hoa', label: '🏛️ Văn hóa – lịch sử' },
          { value: 'tam-linh', label: '🛕 Tâm linh' },
          { value: 'bien', label: '🏖️ Biển' },
          { value: 'lang-co', label: '🏮 Làng cổ' },
        ],
      },
      {
        kind: 'single',
        key: 'duration',
        label: 'Bạn có bao nhiêu thời gian?',
        options: [
          { value: 'halfday', label: 'Nửa ngày', hint: '3 điểm' },
          { value: 'day', label: '1 ngày', hint: '5 điểm' },
          { value: 'multiday', label: '2–3 ngày', hint: '9 điểm' },
        ],
        defaultValue: 'day',
      },
      {
        kind: 'single',
        key: 'radius',
        label: 'Đi xa tối đa (khi dùng vị trí/điểm xuất phát)',
        options: [
          { value: '10', label: '10 km' },
          { value: '30', label: '30 km' },
          { value: '50', label: '50 km' },
          { value: '100', label: '100 km' },
          { value: '200', label: '200 km' },
        ],
        defaultValue: '50',
      },
    ],
  },
  {
    id: 'date',
    slug: 'hen-ho',
    title: 'Hẹn hò',
    short: 'Hẹn hò',
    description: 'Lịch trình hẹn hò theo ngân sách, thời gian và không khí bạn muốn.',
    image: 'date', photoSlug: 'ho-hoan-kiem',
    accent: 'from-rose-950/95 via-rose-900/70',
    cta: 'Lên lịch hẹn hò',
    fields: [
      { kind: 'location', key: 'location', label: 'Hẹn hò ở khu vực nào?', modes: ['gps', 'place', 'province'] },
      {
        kind: 'single',
        key: 'budget',
        label: 'Ngân sách cho 2 người',
        options: [
          { value: '1', label: 'Dưới 300k' },
          { value: '2', label: '300k – 700k' },
          { value: '3', label: '700k – 1,5tr' },
          { value: '4', label: 'Trên 1,5tr' },
        ],
        defaultValue: '2',
      },
      { ...time, optional: false, defaultValue: 'evening' } as Field,
      {
        kind: 'single',
        key: 'duration',
        label: 'Thời lượng',
        options: [
          { value: 'short', label: '1–2 giờ', hint: '2 điểm' },
          { value: 'halfday', label: 'Nửa buổi', hint: '3 điểm' },
          { value: 'day', label: 'Cả ngày', hint: '5 điểm' },
        ],
        defaultValue: 'halfday',
      },
      {
        kind: 'multi',
        key: 'prefs',
        label: 'Không khí mong muốn',
        options: [
          { value: 'lang-man', label: '💕 Lãng mạn' },
          { value: 'soi-dong', label: '🎉 Sôi động' },
          { value: 'am-thuc', label: '😋 Ăn ngon' },
          { value: 'van-hoa', label: '🏛️ Văn hóa' },
        ],
      },
      {
        kind: 'single',
        key: 'radius',
        label: 'Di chuyển trong bán kính',
        options: [
          { value: '2', label: '2 km' },
          { value: '5', label: '5 km' },
          { value: '10', label: '10 km' },
        ],
        defaultValue: '5',
      },
    ],
  },
  {
    id: 'food',
    slug: 'an-uong',
    title: 'Ăn uống',
    short: 'Ăn uống',
    description: 'Quán ngon gần bạn theo bữa, món và ngân sách.',
    image: 'pho', photoSlug: 'pho-thin',
    accent: 'from-orange-950/90 via-orange-900/55',
    cta: 'Tìm quán ăn',
    fields: [
      { kind: 'location', key: 'location', label: 'Bạn đang ở đâu?', modes: ['gps', 'place', 'province'] },
      {
        kind: 'single',
        key: 'meal',
        label: 'Ăn bữa nào?',
        options: [
          { value: 'breakfast', label: '🌅 Bữa sáng' },
          { value: 'lunch', label: '☀️ Bữa trưa' },
          { value: 'dinner', label: '🌙 Bữa tối' },
          { value: 'snack', label: '🍢 Ăn vặt' },
        ],
        optional: true,
      },
      {
        kind: 'multi',
        key: 'prefs',
        label: 'Thèm món gì?',
        hint: 'Bỏ trống = món gì cũng được',
        options: [
          { value: 'pho', label: 'Phở' },
          { value: 'bun-cha', label: 'Bún chả' },
          { value: 'bun', label: 'Bún' },
          { value: 'cha-ca', label: 'Chả cá' },
          { value: 'banh-mi', label: 'Bánh mì' },
          { value: 'banh-cuon', label: 'Bánh cuốn' },
          { value: 'xoi', label: 'Xôi' },
          { value: 'mi-quang', label: 'Mì Quảng' },
          { value: 'banh-xeo', label: 'Bánh xèo' },
          { value: 'che', label: 'Chè' },
          { value: 'nha-hang', label: 'Nhà hàng' },
        ],
      },
      budgetPerPerson,
      {
        kind: 'single',
        key: 'radius',
        label: 'Trong bán kính',
        options: [
          { value: '1', label: '1 km' },
          { value: '3', label: '3 km' },
          { value: '5', label: '5 km' },
          { value: '10', label: '10 km' },
        ],
        defaultValue: '3',
      },
    ],
  },
  {
    id: 'cafe',
    slug: 'ca-phe',
    title: 'Cà phê',
    short: 'Cà phê',
    description: 'Quán cà phê view đẹp, cà phê trứng, quán cổ kính yên tĩnh.',
    image: 'coffee', photoSlug: 'cafe-giang',
    accent: 'from-amber-950/90 via-amber-900/55',
    cta: 'Tìm quán cà phê',
    fields: [
      { kind: 'location', key: 'location', label: 'Bạn đang ở đâu?', modes: ['gps', 'place', 'province'] },
      {
        kind: 'multi',
        key: 'prefs',
        label: 'Bạn thích quán thế nào?',
        options: [
          { value: 'view-dep', label: '🌅 View đẹp' },
          { value: 'dac-san', label: '🥚 Cà phê trứng' },
          { value: 'co-kinh', label: '🕰️ Cổ kính' },
          { value: 'yen-tinh', label: '🤫 Yên tĩnh' },
        ],
      },
      budgetPerPerson,
      {
        kind: 'single',
        key: 'radius',
        label: 'Trong bán kính',
        options: [
          { value: '1', label: '1 km' },
          { value: '3', label: '3 km' },
          { value: '5', label: '5 km' },
        ],
        defaultValue: '3',
      },
    ],
  },
  {
    id: 'family',
    slug: 'gia-dinh',
    title: 'Gia đình & vui chơi',
    short: 'Gia đình',
    description: 'Khu vui chơi, công viên, chỗ ăn hợp cả nhà.',
    image: 'funpark', photoSlug: 'ba-na-hills',
    accent: 'from-violet-950/90 via-violet-900/55',
    cta: 'Gợi ý cho cả nhà',
    fields: [
      { kind: 'location', key: 'location', label: 'Cả nhà xuất phát từ đâu?', modes: ['gps', 'province', 'place'] },
      time,
      budgetPerPerson,
      {
        kind: 'single',
        key: 'radius',
        label: 'Đi xa tối đa',
        options: [
          { value: '5', label: '5 km' },
          { value: '15', label: '15 km' },
          { value: '30', label: '30 km' },
        ],
        defaultValue: '15',
      },
    ],
  },
];

export const intentBySlug = (slug: string) => INTENTS.find((i) => i.slug === slug);

import type { OpeningHours } from '../domain/schemas.js';

export const TIMEZONE = 'Asia/Ho_Chi_Minh';
/** Giờ mở cửa xác minh quá lâu thì coi như không biết – tránh báo sai "đang mở". */
export const HOURS_STALE_DAYS = 180;

export type OpenStatus = 'open' | 'closed' | 'unknown';

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Thứ và số phút trong ngày theo giờ Việt Nam. */
export function vnClock(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { day: WEEKDAY[get('weekday')] ?? 0, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

export function isHoursFresh(hours: OpeningHours | null | undefined, now = new Date()): hours is OpeningHours {
  if (!hours) return false;
  const age = now.getTime() - new Date(hours.verifiedAt).getTime();
  return age >= 0 && age <= HOURS_STALE_DAYS * 86_400_000;
}

export function openStatus(hours: OpeningHours | null | undefined, now = new Date()): OpenStatus {
  if (!isHoursFresh(hours, now)) return 'unknown';
  const { day, minutes } = vnClock(now);
  const yesterday = (day + 6) % 7;
  for (const p of hours.periods) {
    const open = toMin(p.open);
    const close = toMin(p.close);
    if (close > open) {
      if (p.day === day && minutes >= open && minutes < close) return 'open';
    } else {
      // Mở qua đêm, ví dụ 18:00–02:00
      if (p.day === day && minutes >= open) return 'open';
      if (p.day === yesterday && minutes < close) return 'open';
    }
  }
  return 'closed';
}

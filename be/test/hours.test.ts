import { describe, expect, it } from 'vitest';
import { openStatus, vnClock } from '../src/lib/hours.js';

const verifiedAt = '2026-09-01T00:00:00.000Z';
// 2026-10-09 là thứ Sáu (day 5). Giờ VN = UTC+7.
const vn = (hhmm: string, date = '2026-10-09') => new Date(`${date}T${hhmm}:00+07:00`);

describe('vnClock', () => {
  it('quy đổi sang giờ Việt Nam', () => {
    expect(vnClock(new Date('2026-10-08T20:30:00Z'))).toEqual({ day: 5, minutes: 3 * 60 + 30 });
  });
});

describe('openStatus', () => {
  const daytime = { periods: [{ day: 5, open: '07:00', close: '21:30' }], verifiedAt };

  it('mở / đóng trong ngày', () => {
    expect(openStatus(daytime, vn('08:00'))).toBe('open');
    expect(openStatus(daytime, vn('21:30'))).toBe('closed');
    expect(openStatus(daytime, vn('06:59'))).toBe('closed');
  });

  it('mở qua đêm tính sang ngày hôm sau', () => {
    const night = { periods: [{ day: 5, open: '18:00', close: '02:00' }], verifiedAt };
    expect(openStatus(night, vn('23:00'))).toBe('open');
    expect(openStatus(night, vn('01:30', '2026-10-10'))).toBe('open');
    expect(openStatus(night, vn('02:30', '2026-10-10'))).toBe('closed');
  });

  it('không có dữ liệu hoặc dữ liệu quá cũ → unknown, không đoán', () => {
    expect(openStatus(null, vn('08:00'))).toBe('unknown');
    expect(openStatus({ ...daytime, verifiedAt: '2025-01-01T00:00:00.000Z' }, vn('08:00'))).toBe('unknown');
  });
});

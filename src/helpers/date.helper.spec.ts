import {
  businessDayRange,
  businessToday,
  dateColumnRange,
  resolveDateOnly,
  resolveTransactionDate,
} from './date.helper.js';

describe('date.helper', () => {
  describe('businessToday', () => {
    it('returns the PKT calendar day, not the UTC day', () => {
      // 2026-10-06 22:30 UTC = 2026-10-07 03:30 PKT — still the owner's day.
      expect(businessToday(new Date('2026-10-06T22:30:00.000Z'))).toBe(
        '2026-10-07',
      );
    });

    it('crosses to the next day at PKT midnight, not UTC midnight', () => {
      // 2026-10-06 18:59 UTC = 2026-10-06 23:59 PKT — still the 6th.
      expect(businessToday(new Date('2026-10-06T18:59:00.000Z'))).toBe(
        '2026-10-06',
      );
      // 2026-10-06 19:00 UTC = 2026-10-07 00:00 PKT — the 7th begins.
      expect(businessToday(new Date('2026-10-06T19:00:00.000Z'))).toBe(
        '2026-10-07',
      );
    });
  });

  describe('businessDayRange', () => {
    it('spans PKT midnight to PKT midnight', () => {
      const { start, end } = businessDayRange('2026-10-07');

      expect(start.toISOString()).toBe('2026-10-06T19:00:00.000Z');
      expect(end.toISOString()).toBe('2026-10-07T19:00:00.000Z');
    });

    it('covers exactly the instants businessToday agrees with', () => {
      const { start, end } = businessDayRange('2026-10-07');

      // First and last millisecond of the PKT day.
      expect(businessToday(start)).toBe('2026-10-07');
      expect(businessToday(new Date(end.getTime() - 1))).toBe('2026-10-07');
      expect(businessToday(end)).toBe('2026-10-08');
    });
  });

  describe('resolveTransactionDate', () => {
    it('returns now when date is omitted', () => {
      const now = new Date('2026-10-27T10:30:00.000Z');
      expect(resolveTransactionDate(undefined, now)).toBe(now);
    });

    it('returns now when date matches current business day', () => {
      const now = new Date('2026-10-27T10:30:00.000Z');
      const today = businessToday(now);
      expect(resolveTransactionDate(today, now)).toBe(now);
    });

    it('returns parsed date when date is a past or different day', () => {
      const now = new Date('2026-10-27T10:30:00.000Z');
      const past = '2026-10-01';
      const result = resolveTransactionDate(past, now);
      expect(result).not.toBe(now);
      expect(result.toISOString()).toContain('2026-10-01');
    });
  });

  describe('resolveDateOnly', () => {
    it('resolves the transaction date to today in Asia/Karachi even when UTC time is still yesterday (e.g. 1:00 AM PKT / 20:00 UTC)', () => {
      // 1:00 AM PKT on Oct 31, 2026 = 20:00 UTC on Oct 30, 2026
      const mockNow = new Date('2026-10-30T20:00:00.000Z');
      const expected = new Date('2026-10-31T00:00:00.000Z');

      expect(resolveDateOnly(undefined, mockNow)).toEqual(expected);
      expect(resolveDateOnly('2026-10-31', mockNow)).toEqual(expected);
      expect(resolveDateOnly(mockNow, mockNow)).toEqual(expected);
    });

    it('resolves explicit past or future date strings correctly', () => {
      const result = resolveDateOnly('2026-10-15');
      expect(result).toEqual(new Date('2026-10-15T00:00:00.000Z'));
    });

    it('trims whitespace and falls back to businessToday when string is too short', () => {
      const mockNow = new Date('2026-10-30T20:00:00.000Z');
      expect(resolveDateOnly('  2026-10-15  ', mockNow)).toEqual(
        new Date('2026-10-15T00:00:00.000Z'),
      );
      expect(resolveDateOnly('   ', mockNow)).toEqual(
        new Date('2026-10-31T00:00:00.000Z'),
      );
    });

    it('ensures transactions recorded across all PKT hours match dateColumnRange for today', () => {
      // 12:00 AM PKT (19:00 UTC Oct 30)
      const midnightPKT = new Date('2026-10-30T19:00:00.000Z');
      // 4:59 AM PKT (23:59 UTC Oct 30)
      const lateNightPKT = new Date('2026-10-30T23:59:00.000Z');
      // 5:00 AM PKT (00:00 UTC Oct 31)
      const dawnPKT = new Date('2026-10-31T00:00:00.000Z');
      // 11:59 PM PKT (18:59 UTC Oct 31)
      const endOfDayPKT = new Date('2026-10-31T18:59:00.000Z');

      const expectedDay = '2026-10-31';
      const range = dateColumnRange(expectedDay, expectedDay);

      for (const instant of [midnightPKT, lateNightPKT, dawnPKT, endOfDayPKT]) {
        expect(businessToday(instant)).toBe(expectedDay);
        const resolved = resolveDateOnly(undefined, instant);
        expect(resolved).toEqual(new Date(`${expectedDay}T00:00:00.000Z`));
        expect(resolved.getTime()).toBeGreaterThanOrEqual(range.gte.getTime());
        expect(resolved.getTime()).toBeLessThan(range.lt.getTime());
      }
    });
  });
});

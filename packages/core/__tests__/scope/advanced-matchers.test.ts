import {
  ageBucket,
  ageBucketForDays,
  dateInRange,
  isoToDayNumber,
  listIncludesAny,
} from '../../src/scope/advanced-matchers';

describe('ageBucketForDays', () => {
  it('buckets in 5-day increments', () => {
    expect(ageBucketForDays(1)).toBe('1-5');
    expect(ageBucketForDays(5)).toBe('1-5');
    expect(ageBucketForDays(6)).toBe('6-10');
    expect(ageBucketForDays(11)).toBe('11-15');
  });

  it('rounds a note created today up to 1', () => {
    expect(ageBucketForDays(0)).toBe('1-5');
    expect(ageBucketForDays(-3)).toBe('1-5');
  });
});

describe('ageBucket', () => {
  it('computes today minus date-created', () => {
    expect(ageBucket('2026-01-01', '2026-01-01')).toBe('1-5');
    expect(ageBucket('2026-01-01', '2026-01-07')).toBe('6-10');
  });

  it('returns null on unparseable dates', () => {
    expect(ageBucket('not-a-date', '2026-01-01')).toBeNull();
    expect(ageBucket('2026-01-01', undefined)).toBeNull();
    expect(ageBucket('2026-02-30', '2026-03-01')).toBeNull();
  });
});

describe('dateInRange', () => {
  it('honors after and before inclusive bounds', () => {
    expect(dateInRange('2026-03-15', {after: '2026-03-01', before: '2026-03-31'})).toBe(true);
    expect(dateInRange('2026-03-01', {after: '2026-03-01'})).toBe(true);
    expect(dateInRange('2026-02-28', {after: '2026-03-01'})).toBe(false);
    expect(dateInRange('2026-04-01', {before: '2026-03-31'})).toBe(false);
  });

  it('is false for an unparseable date', () => {
    expect(dateInRange('nope', {after: '2026-01-01'})).toBe(false);
    expect(dateInRange('2026-01-15', {after: 'not-a-date'})).toBe(false);
    expect(dateInRange('2026-01-15', {after: '2026-02-01', before: '2026-01-01'})).toBe(false);
  });
});

describe('isoToDayNumber', () => {
  it('parses ISO dates with an optional time suffix', () => {
    expect(isoToDayNumber('2026-01-01')).toBe(isoToDayNumber('2026-01-01T12:00:00'));
    expect(isoToDayNumber(42)).toBeNull();
  });
});

describe('listIncludesAny', () => {
  it('matches case-insensitively', () => {
    expect(listIncludesAny(['Project'], ['project', 'note'])).toBe(true);
    expect(listIncludesAny(['missing'], ['a', 'b'])).toBe(false);
    expect(listIncludesAny(['x'], undefined)).toBe(false);
  });
});

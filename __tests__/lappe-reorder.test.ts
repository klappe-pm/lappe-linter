import {moveItem} from '../src/lappe/reorder';

describe('moveItem', () => {
  const base = ['a', 'b', 'c', 'd'];

  it('moves an earlier item to a later position', () => {
    expect(moveItem(base, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves a later item to an earlier position', () => {
    expect(moveItem(base, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('returns an unchanged copy for a no-op move', () => {
    const result = moveItem(base, 1, 1);
    expect(result).toEqual(base);
    expect(result).not.toBe(base);
  });

  it('returns an unchanged copy for out-of-range indices', () => {
    expect(moveItem(base, -1, 2)).toEqual(base);
    expect(moveItem(base, 0, 9)).toEqual(base);
  });

  it('does not mutate the input', () => {
    const input = [...base];
    moveItem(input, 0, 3);
    expect(input).toEqual(base);
  });
});

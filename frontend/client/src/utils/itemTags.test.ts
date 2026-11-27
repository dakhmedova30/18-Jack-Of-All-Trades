import { describe, expect, it } from 'vitest';
import { hasOnlyItemTagCharacters } from './itemTags';

describe('hasOnlyItemTagCharacters', () => {
  it.each([
    'Mother’s Day',
    "cat's",
    '3.5in',
    '18+',
    '50% off (set)!',
    'B&W',
    'hand-made',
    '3/4 sleeve',
    '#1: café',
    '陶器_2',
  ])('allows %s', (tag) => {
    expect(hasOnlyItemTagCharacters(tag)).toBe(true);
  });

  it.each(['red, blue', 'a;b', 'x@y', 'quote"', 'tab\there'])('rejects %s', (tag) => {
    expect(hasOnlyItemTagCharacters(tag)).toBe(false);
  });
});

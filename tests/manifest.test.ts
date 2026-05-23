import { describe, expect, it } from 'vitest';
import { listPatterns } from '../sdk/src/index.js';

describe('pattern manifest scaffold', () => {
  it('exposes at least the first core planning entries', () => {
    const patterns = listPatterns();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0]?.id).toBe('core.ownable');
  });
});

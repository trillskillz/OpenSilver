import { describe, expect, it } from 'vitest';
import { listPatterns } from '../sdk/src/index.js';

describe('pattern manifest scaffold', () => {
  it('exposes the first core entries and marks Ownable as scaffolded', () => {
    const patterns = listPatterns();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0]?.id).toBe('core.ownable');
    expect(patterns[0]?.status).toBe('scaffolded');
    expect(patterns[0]?.contractPath).toBe('contracts/core/ownable.sil');
    expect(patterns[0]?.docPath).toBe('docs/patterns/core/ownable.md');
  });
});

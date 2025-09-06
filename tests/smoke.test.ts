import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(true).toBe(true);
  });

  it('can import main modules', () => {
    // Test that main modules can be imported without errors
    expect(() => import('../src/index')).not.toThrow();
    expect(() => import('../src/lib/ledger')).not.toThrow();
    expect(() => import('../src/lib/money')).not.toThrow();
  });
});

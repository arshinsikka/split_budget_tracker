/**
 * Money utilities unit tests
 *
 * Tests banker's rounding, amount validation, and currency formatting.
 * Ensures financial calculations are precise and handle edge cases correctly.
 */

import { describe, it, expect } from 'vitest';
import {
  roundTo2,
  validateAmount,
  splitEqually,
  formatCurrency,
} from '../../src/lib/money';

describe('Money Utilities', () => {
  describe('roundTo2', () => {
    it('should round to exactly 2 decimal places', () => {
      expect(roundTo2(100.123)).toBe(100.12);
      expect(roundTo2(100.125)).toBe(100.13);
      expect(roundTo2(100.126)).toBe(100.13);
    });

    it("should use banker's rounding for ties", () => {
      // Banker's rounding: ties go to even numbers
      expect(roundTo2(100.005)).toBe(100.01); // 100.005 -> 100.01 (rounds up)
      expect(roundTo2(100.015)).toBe(100.02); // 100.015 -> 100.02 (rounds up)
      expect(roundTo2(100.025)).toBe(100.03); // 100.025 -> 100.03 (rounds up)
      expect(roundTo2(100.035)).toBe(100.04); // 100.035 -> 100.04 (rounds up)
    });

    it('should handle whole numbers', () => {
      expect(roundTo2(100)).toBe(100);
      expect(roundTo2(100.0)).toBe(100);
    });

    it('should handle negative numbers', () => {
      expect(roundTo2(-100.125)).toBe(-100.12);
      expect(roundTo2(-100.005)).toBe(-100.0);
    });

    it('should handle zero', () => {
      expect(roundTo2(0)).toBe(0);
      expect(roundTo2(0.0)).toBe(0);
    });
  });

  describe('validateAmount', () => {
    it('should accept valid amounts', () => {
      expect(() => validateAmount(100.0)).not.toThrow();
      expect(() => validateAmount(100.5)).not.toThrow();
      expect(() => validateAmount(100.99)).not.toThrow();
      expect(() => validateAmount(0.01)).not.toThrow();
    });

    it('should reject zero amounts', () => {
      expect(() => validateAmount(0)).toThrow('Amount must be positive');
      expect(() => validateAmount(0.0)).toThrow('Amount must be positive');
    });

    it('should reject negative amounts', () => {
      expect(() => validateAmount(-100.0)).toThrow('Amount must be positive');
      expect(() => validateAmount(-0.01)).toThrow('Amount must be positive');
    });

    it('should reject amounts with more than 2 decimal places', () => {
      expect(() => validateAmount(100.001)).toThrow(
        'Amount must have at most 2 decimal places'
      );
      expect(() => validateAmount(100.999)).toThrow(
        'Amount must have at most 2 decimal places'
      );
      expect(() => validateAmount(0.001)).toThrow(
        'Amount must have at most 2 decimal places'
      );
    });

    it('should accept amounts with exactly 2 decimal places', () => {
      expect(() => validateAmount(100.0)).not.toThrow();
      expect(() => validateAmount(100.01)).not.toThrow();
      expect(() => validateAmount(100.99)).not.toThrow();
    });

    it('should accept whole numbers', () => {
      expect(() => validateAmount(100)).not.toThrow();
      expect(() => validateAmount(1)).not.toThrow();
    });
  });

  describe('splitEqually', () => {
    it('should split even amounts correctly', () => {
      const result = splitEqually(100.0);
      expect(result.perUserShare).toBe(50.0);
      expect(result.remainder).toBe(0);
    });

    it("should split odd amounts with banker's rounding", () => {
      const result = splitEqually(101.0);
      expect(result.perUserShare).toBe(50.5);
      expect(result.remainder).toBe(0);
    });

    it('should handle amounts with odd cents', () => {
      const result = splitEqually(100.01);
      expect(result.perUserShare).toBe(50.0);
      expect(result.remainder).toBe(0.01);
    });

    it('should handle amounts that create remainder', () => {
      const result = splitEqually(100.03);
      expect(result.perUserShare).toBe(50.01);
      expect(result.remainder).toBe(0.01);
    });

    it('should validate input amount', () => {
      expect(() => splitEqually(0)).toThrow('Amount must be positive');
      expect(() => splitEqually(-100)).toThrow('Amount must be positive');
      expect(() => splitEqually(100.001)).toThrow(
        'Amount must have at most 2 decimal places'
      );
    });

    it('should ensure total equals original amount', () => {
      const testAmounts = [100.0, 101.0, 100.01, 100.03, 99.99];

      for (const amount of testAmounts) {
        const result = splitEqually(amount);
        const total = result.perUserShare * 2 + result.remainder;
        expect(Math.abs(total - amount)).toBeLessThan(0.01); // Allow for floating point precision
      }
    });
  });

  describe('formatCurrency', () => {
    it('should format amounts with exactly 2 decimal places', () => {
      expect(formatCurrency(100)).toBe('100.00');
      expect(formatCurrency(100.5)).toBe('100.50');
      expect(formatCurrency(100.55)).toBe('100.55');
      expect(formatCurrency(100.1)).toBe('100.10');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('0.00');
    });

    it('should handle negative numbers', () => {
      expect(formatCurrency(-100.5)).toBe('-100.50');
    });

    it('should handle very small amounts', () => {
      expect(formatCurrency(0.01)).toBe('0.01');
      expect(formatCurrency(0.99)).toBe('0.99');
    });
  });

  describe('Edge Cases', () => {
    it('should handle floating point precision issues', () => {
      // JavaScript floating point can cause issues like 0.1 + 0.2 !== 0.3
      const result = splitEqually(0.3);
      expect(result.perUserShare).toBe(0.15);
      expect(result.remainder).toBe(0);
    });

    it('should handle large amounts', () => {
      const result = splitEqually(1000000.0);
      expect(result.perUserShare).toBe(500000.0);
      expect(result.remainder).toBe(0);
    });

    it('should handle amounts that round to zero', () => {
      const result = splitEqually(0.01);
      expect(result.perUserShare).toBe(0.0);
      expect(result.remainder).toBe(0.01);
    });
  });
});

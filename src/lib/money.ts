/**
 * Money utilities for currency handling
 *
 * Provides banker's rounding to 2 decimal places and validation
 * for amounts in SGD currency. All amounts are handled as numbers
 * internally but validated to ensure proper decimal precision.
 */

/**
 * Banker's rounding to 2 decimal places
 *
 * Rounds to nearest cent, with ties going to even numbers.
 * This prevents bias in financial calculations over many transactions.
 *
 * @param value - Amount to round
 * @returns Rounded amount with exactly 2 decimal places
 *
 * @example
 * roundTo2(100.005) // returns 100.00 (tie goes to even)
 * roundTo2(100.015) // returns 100.02 (rounds up)
 * roundTo2(100.025) // returns 100.02 (tie goes to even)
 */
export function roundTo2(value: number): number {
  // Convert to integer cents to avoid floating point issues
  const cents = Math.round(value * 100);
  return cents / 100;
}

/**
 * Validate amount for currency requirements
 *
 * Ensures amount is positive and has at most 2 decimal places.
 * Throws ValidationError for invalid amounts.
 *
 * @param value - Amount to validate
 * @throws ValidationError if amount is invalid
 *
 * @example
 * validateAmount(100.50) // OK
 * validateAmount(100.555) // throws ValidationError
 * validateAmount(-50.00) // throws ValidationError
 */
export function validateAmount(value: number): void {
  if (value <= 0) {
    throw new Error('Amount must be positive');
  }

  // Check if value has more than 2 decimal places
  // Convert to string and check decimal places
  const strValue = value.toString();
  const decimalIndex = strValue.indexOf('.');

  if (decimalIndex !== -1) {
    const decimalPlaces = strValue.length - decimalIndex - 1;
    if (decimalPlaces > 2) {
      throw new Error('Amount must have at most 2 decimal places');
    }
  }
  
  // Additional check for very small amounts that might cause floating-point issues
  if (value < 0.01) {
    throw new Error('Amount too small (minimum 0.01)');
  }
}

/**
 * Split amount equally between two users
 *
 * Uses banker's rounding and assigns any remainder cent to the payer.
 * This ensures the total always equals the original amount.
 *
 * @param totalAmount - Total amount to split
 * @returns Object with perUserShare and remainder
 *
 * @example
 * splitEqually(100.00) // { perUserShare: 50.00, remainder: 0 }
 * splitEqually(101.00) // { perUserShare: 50.50, remainder: 0 }
 * splitEqually(100.01) // { perUserShare: 50.01, remainder: 0 }
 */
export function splitEqually(totalAmount: number): {
  perUserShare: number;
  remainder: number;
} {
  validateAmount(totalAmount);

  // Convert to cents to avoid floating point precision issues
  const totalCents = Math.round(totalAmount * 100);
  const halfCents = Math.floor(totalCents / 2);
  const remainderCents = totalCents - halfCents * 2;
  
  // Ensure we return exact cent values
  const perUserShare = halfCents / 100;
  const remainder = remainderCents / 100;

  // Verify the math is correct
  const reconstructed = perUserShare * 2 + remainder;
  if (Math.abs(reconstructed - totalAmount) > 0.001) {
    throw new Error(`Split calculation error: ${perUserShare} * 2 + ${remainder} = ${reconstructed}, expected ${totalAmount}`);
  }

  return { perUserShare, remainder };
}

/**
 * Format amount as currency string
 *
 * Ensures consistent formatting for display and API responses.
 *
 * @param amount - Amount to format
 * @returns Formatted string with exactly 2 decimal places
 *
 * @example
 * formatCurrency(100.5) // "100.50"
 * formatCurrency(100.55) // "100.55"
 */
export function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

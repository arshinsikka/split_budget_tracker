// Independent oracle for computing expected wallet balances, budgets, and net due
// This is a separate model that doesn't import any app code

export interface OracleState {
  walletA: number;
  walletB: number;
  budgetA: Record<string, number>;
  budgetB: Record<string, number>;
  netDue: number; // positive means B owes A, negative means A owes B
}

export class Oracle {
  private state: OracleState;

  constructor() {
    this.state = {
      walletA: 0, // Will be set by seeding
      walletB: 0, // Will be set by seeding
      budgetA: {
        food: 0,
        groceries: 0,
        transport: 0,
        entertainment: 0,
        other: 0,
      },
      budgetB: {
        food: 0,
        groceries: 0,
        transport: 0,
        entertainment: 0,
        other: 0,
      },
      netDue: 0,
    };
  }

  // Set initial wallet balances (for seeding)
  setInitialWallets(walletA: number, walletB: number): void {
    this.state.walletA = this.roundTo2(walletA);
    this.state.walletB = this.roundTo2(walletB);
  }

  getState(): OracleState {
    return { ...this.state };
  }

  // Banker's rounding to 2 decimal places
  private roundTo2(value: number): number {
    // Banker's rounding: ties go to even numbers
    // For amounts like 0.005, round to nearest even cent
    const cents = value * 100;
    const floor = Math.floor(cents);
    const remainder = cents - floor;

    if (remainder === 0.5) {
      // Tie case: round to even
      return (floor + (floor % 2)) / 100;
    } else {
      // Normal case: round to nearest
      return Math.round(cents) / 100;
    }
  }

  // Handle odd cent remainder by assigning to payer's receivable
  // According to ADR: budgets are T/2 each (banker's rounding)
  // Remainder only affects receivable/payable, not budgets
  private splitAmount(amount: number): { shareA: number; shareB: number; remainder: number } {
    const half = amount / 2;
    const roundedHalf = this.roundTo2(half);
    const remainder = amount - roundedHalf * 2;

    // Both users get the same rounded amount for budgets
    return { shareA: roundedHalf, shareB: roundedHalf, remainder };
  }

  // Record a group expense
  recordExpense(payer: 'A' | 'B', amount: number, category: string): void {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const { shareA, shareB, remainder } = this.splitAmount(amount);

    // Update wallets
    if (payer === 'A') {
      this.state.walletA -= amount;
    } else {
      this.state.walletB -= amount;
    }

    // Update budgets (both get the same rounded amount)
    this.state.budgetA[category] = this.roundTo2(this.state.budgetA[category] + shareA);
    this.state.budgetB[category] = this.roundTo2(this.state.budgetB[category] + shareB);

    // Update net due using DUE_FROM logic (matching API exactly)
    // netDue represents: (A's receivable from B) - (B's receivable from A)
    if (payer === 'A') {
      // A paid, so B owes A their share + remainder
      // This increases A's receivable from B (positive netDue)
      const receivableAmount = shareB + remainder;
      this.state.netDue = this.roundTo2(this.state.netDue + receivableAmount);
    } else {
      // B paid, so A owes B their share + remainder
      // This increases B's receivable from A (negative netDue)
      const receivableAmount = shareA + remainder;
      this.state.netDue = this.roundTo2(this.state.netDue - receivableAmount);
    }
  }

  // Record a settlement
  recordSettlement(from: 'A' | 'B', to: 'A' | 'B', amount: number): void {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    if (from === to) {
      throw new Error('Cannot settle with yourself');
    }

    // Update wallets
    if (from === 'A') {
      this.state.walletA -= amount;
      this.state.walletB += amount;
    } else {
      this.state.walletB -= amount;
      this.state.walletA += amount;
    }

    // Update net due using DUE_FROM logic (matching API exactly)
    // netDue represents: (A's receivable from B) - (B's receivable from A)
    if (from === 'A' && to === 'B') {
      // A pays B, reduces A's debt to B
      // This decreases B's receivable from A (increases netDue)
      this.state.netDue = this.roundTo2(this.state.netDue + amount);
    } else {
      // B pays A, reduces B's debt to A
      // This decreases A's receivable from B (decreases netDue)
      this.state.netDue = this.roundTo2(this.state.netDue - amount);
    }
  }

  // Get net due in the format expected by the API
  getNetDue(): { owes: 'A' | 'B' | null; amount: number } {
    if (Math.abs(this.state.netDue) < 0.01) {
      return { owes: null, amount: 0 };
    } else if (this.state.netDue > 0) {
      return { owes: 'B', amount: this.state.netDue };
    } else {
      return { owes: 'A', amount: Math.abs(this.state.netDue) };
    }
  }

  // Get user summaries in the format expected by the API
  getUserSummaries(): {
    users: Array<{
      userId: 'A' | 'B';
      walletBalance: number;
      budgetByCategory: Record<string, number>;
    }>;
    netDue: { owes: 'A' | 'B' | null; amount: number };
  } {
    return {
      users: [
        {
          userId: 'A',
          walletBalance: this.roundTo2(this.state.walletA),
          budgetByCategory: { ...this.state.budgetA },
        },
        {
          userId: 'B',
          walletBalance: this.roundTo2(this.state.walletB),
          budgetByCategory: { ...this.state.budgetB },
        },
      ],
      netDue: this.getNetDue(),
    };
  }
}

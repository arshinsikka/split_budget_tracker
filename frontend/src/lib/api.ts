const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// RFC 7807 Problem Details interface
export interface ProblemDetails {
  type: string;
  title: string;
  detail: string;
  status: number;
}

// API Response interfaces
export interface HealthResponse {
  status: string;
  timestamp: string;
  service: string;
  version: string;
}

export interface User {
  userId: string;
  walletBalance: number;
  budgetByCategory: {
    food: number;
    groceries: number;
    transport: number;
    entertainment: number;
    other: number;
  };
}

export interface UsersResponse {
  users: User[];
  netDue: {
    owes: string | null;
    amount: number;
  };
}

export interface Transaction {
  id: string;
  type: 'GROUP' | 'SETTLEMENT' | 'INITIAL';
  payerId?: string;
  amount: number;
  category?: string;
  perUserShare?: number;
  remainder?: number;
  fromUserId?: string;
  toUserId?: string;
  createdAt: string;
}

export interface CreateTransactionRequest {
  payerId: string;
  amount: string;
  category: string;
}

export interface CreateTransactionResponse {
  transaction: Transaction;
  summary: UsersResponse;
}

export interface SettleRequest {
  fromUserId: string;
  toUserId: string;
  amount: string;
}

export interface SettleResponse {
  settlement: Transaction;
  summary: UsersResponse;
}

export interface SummaryResponse {
  userId: string;
  walletBalance: number;
  budgetByCategory: {
    food: number;
    groceries: number;
    transport: number;
    entertainment: number;
    other: number;
  };
  netPosition: {
    owes: string | null;
    amount: number;
  };
}

export interface WhoOwesWhoResponse {
  owes: string | null;
  to: string | null;
  amount: number;
}

// Custom error class for API errors
export class APIError extends Error {
  public status: number;
  public problemDetails?: ProblemDetails;

  constructor(message: string, status: number, problemDetails?: ProblemDetails) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.problemDetails = problemDetails;
  }
}

// Generic fetch wrapper with error handling
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      let problemDetails: ProblemDetails | undefined;
      
      try {
        problemDetails = await response.json();
      } catch {
        // If response is not JSON, create a basic problem details object
        problemDetails = {
          type: 'unknown-error',
          title: `HTTP ${response.status}`,
          detail: response.statusText,
          status: response.status,
        };
      }

      throw new APIError(
        problemDetails?.detail || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        problemDetails
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    // Network errors or other fetch errors
    throw new APIError(
      error instanceof Error ? error.message : 'Network error',
      0
    );
  }
}

// API client functions
export const api = {
  // Health check
  getHealth(): Promise<HealthResponse> {
    return apiRequest<HealthResponse>('/health');
  },

  // Get all users
  getUsers(): Promise<UsersResponse> {
    return apiRequest<UsersResponse>('/users');
  },

  // Create a transaction
  createTransaction(
    data: CreateTransactionRequest,
    idempotencyKey?: string
  ): Promise<CreateTransactionResponse> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return apiRequest<CreateTransactionResponse>('/transactions', {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  },

  // Get all transactions
  getTransactions(): Promise<Transaction[]> {
    return apiRequest<Transaction[]>('/transactions');
  },

  // Settle debt between users
  settle(
    data: SettleRequest,
    idempotencyKey?: string
  ): Promise<SettleResponse> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return apiRequest<SettleResponse>('/settle', {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  },

  // Get user summary
  getSummary(userId: string): Promise<SummaryResponse> {
    return apiRequest<SummaryResponse>(`/summary?userId=${userId}`);
  },

  // Get who owes who
  getWhoOwesWho(): Promise<WhoOwesWhoResponse> {
    return apiRequest<WhoOwesWhoResponse>('/who-owes-who');
  },
};

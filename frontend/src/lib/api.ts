import {
  CreateTransactionSchema,
  SettlementSchema,
  type CreateTransactionRequest,
  type SettlementRequest,
} from './validation';

// Environment configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const DEBUG_HTTP = import.meta.env.VITE_DEBUG_HTTP === 'true';

// RFC 7807 Problem Details interface
export interface ProblemDetails {
  type?: string;
  title?: string;
  detail?: string;
  status?: number;
  instance?: string;
}

// API Error class with better error handling
export class APIError extends Error {
  public status: number;
  public problemDetails?: ProblemDetails;

  constructor(message: string, status: number, problemDetails?: ProblemDetails) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.problemDetails = problemDetails;
  }

  getDisplayMessage(): string {
    if (this.problemDetails?.title && this.problemDetails?.detail) {
      return `${this.problemDetails.title}: ${this.problemDetails.detail}`;
    }
    return this.message;
  }
}

// Generic fetch wrapper with enhanced error handling and debug logging
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  // Merge headers ONCE and set them last so they cannot be overwritten
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  // Build final options: spread options first, then set headers
  const finalOptions: RequestInit = {
    ...options,
    headers: finalHeaders,
  };

  if (DEBUG_HTTP) {
    console.log(`🚀 API Request: ${finalOptions.method || 'GET'} ${url}`);
    console.log('📤 Headers:', finalHeaders);
    if (finalOptions.body) console.log('📤 Body:', finalOptions.body);
  }

  const response = await fetch(url, finalOptions);

  if (DEBUG_HTTP) {
    console.log(`📥 Response: ${response.status} ${response.statusText}`);
  }

  if (!response.ok) {
    let problemDetails: ProblemDetails | undefined;
    try {
      problemDetails = await response.json();
      if (DEBUG_HTTP) console.log('📥 Error Response:', problemDetails);
    } catch {
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

  const data = await response.json();
  if (DEBUG_HTTP) console.log('📥 Success Response:', data);
  return data;
}

// API object with all endpoints
export const api = {
  // Health check
  async getHealth() {
    return apiRequest<{ status: string; timestamp: string; service: string; version: string }>(
      '/health'
    );
  },

  // Get all users
  async getUsers() {
    return apiRequest<{ users: any[]; netDue: { owes: string | null; amount: number } }>('/users');
  },

  // Create transaction with validation
  async createTransaction(data: CreateTransactionRequest, idempotencyKey?: string) {
    // Validate data before sending
    const validatedData = CreateTransactionSchema.parse(data);

    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return apiRequest<{ transaction: any; summary: any }>('/transactions', {
      method: 'POST',
      body: JSON.stringify(validatedData),
      headers,
    });
  },

  // Get all transactions
  async getTransactions() {
    return apiRequest<any[]>('/transactions');
  },

  // Settle debt with validation
  async settle(data: SettlementRequest, idempotencyKey?: string) {
    // Validate data before sending
    const validatedData = SettlementSchema.parse(data);

    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return apiRequest<{ settlement: any; summary: any }>('/settle', {
      method: 'POST',
      body: JSON.stringify(validatedData),
      headers,
    });
  },

  // Get user summary
  async getSummary(userId: string) {
    return apiRequest<any>(`/summary?userId=${userId}`);
  },

  // Get debt status
  async getWhoOwesWho() {
    return apiRequest<{ owes: string | null; to: string | null; amount: number }>('/who-owes-who');
  },

  // Reset all data
  async resetData(demo: boolean = true) {
    return apiRequest<any>(`/seed/init?demo=${demo}`, {
      method: 'POST',
    });
  },
};

/**
 * Centralized error handling middleware
 *
 * Provides consistent error responses across the API and logs errors
 * for debugging. Maps different error types to appropriate HTTP status codes.
 */

import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class ValidationError extends Error implements AppError {
  statusCode = 400;
  isOperational = true;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error implements AppError {
  statusCode = 404;
  isOperational = true;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error implements AppError {
  statusCode = 409;
  isOperational = true;

  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export function errorHandler(
  error: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error for debugging
  console.error('Error:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
  });

  // Determine status code
  const statusCode = error.statusCode || 500;
  const isOperational = error.isOperational || false;

  // Don't leak internal errors in production
  const message =
    isOperational || process.env.NODE_ENV === 'development'
      ? error.message
      : 'Internal server error';

  res.status(statusCode).json({
    error: {
      name: error.name,
      message,
      statusCode,
    },
  });
}

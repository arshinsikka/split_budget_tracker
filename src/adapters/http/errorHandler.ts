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
  statusCode = 422;
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

  // Return RFC 7807 Problem Details format
  res.status(statusCode).type('application/problem+json').json({
    type: getErrorType(error.name),
    title: getErrorTitle(error.name),
    detail: message,
    status: statusCode,
  });
}

function getErrorType(errorName: string): string {
  switch (errorName) {
    case 'ValidationError':
      return 'validation-error';
    case 'ConflictError':
      return 'idempotency-conflict';
    case 'NotFoundError':
      return 'not-found';
    default:
      return 'internal-error';
  }
}

function getErrorTitle(errorName: string): string {
  switch (errorName) {
    case 'ValidationError':
      return 'Invalid request body';
    case 'ConflictError':
      return 'Idempotency conflict';
    case 'NotFoundError':
      return 'Resource not found';
    default:
      return 'Internal server error';
  }
}

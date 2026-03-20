/**
 * src/lib/errors.ts — Application error hierarchy
 *
 * Consistent error handling across all API routes.
 * Every error has: a human message, a machine code, and an HTTP status.
 *
 * Usage in API routes:
 *   throw new UnauthorisedError();
 *   throw new NotFoundError('Order');
 *   throw new ValidationError('Email is required');
 *
 * The apiHandler wrapper in src/lib/api-handler.ts catches these
 * and returns the correct HTTP response automatically.
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class UnauthorisedError extends AppError {
  constructor(message = 'Unauthorised') {
    super(message, 'UNAUTHORISED', 401);
    this.name = 'UnauthorisedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super('Too many requests', 'RATE_LIMITED', 429);
    this.name = 'RateLimitError';
  }
}

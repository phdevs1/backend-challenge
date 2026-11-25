/**
 * Errors the business rules can raise. They say *what* went wrong; the HTTP status they map to is
 * decided in routes/error-handler.ts.
 */
export class ValidationError extends Error {
  override readonly name = 'ValidationError';
}

export class NotFoundError extends Error {
  override readonly name = 'NotFoundError';
}

export class ConflictError extends Error {
  override readonly name = 'ConflictError';
}

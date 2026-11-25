import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors.js';

/** Every error leaves the API as `{ "error": "<message>" }`, as the contract requires. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  const { status, message } = toHttpError(err);
  if (status === 500) console.error(err);
  res.status(status).json({ error: message });
};

function toHttpError(err: unknown): { status: number; message: string } {
  if (err instanceof ValidationError) return { status: 400, message: err.message };
  if (err instanceof NotFoundError) return { status: 404, message: err.message };
  if (err instanceof ConflictError) return { status: 409, message: err.message };
  if (isMalformedJson(err)) return { status: 400, message: 'Malformed JSON body' };
  return { status: 500, message: 'Internal server error' };
}

function isMalformedJson(err: unknown): err is SyntaxError {
  return err instanceof SyntaxError && 'status' in err && err.status === 400;
}

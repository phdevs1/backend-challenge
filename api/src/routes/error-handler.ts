import type { ErrorRequestHandler, RequestHandler } from 'express';

/** Every error leaves the API as `{ "error": "<message>" }`, as the contract requires. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (isMalformedJson(err)) {
    res.status(400).json({ error: 'Malformed JSON body' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};

function isMalformedJson(err: unknown): boolean {
  return err instanceof SyntaxError && 'status' in err && err.status === 400;
}

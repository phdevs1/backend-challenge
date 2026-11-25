import type { z } from 'zod';
import { ValidationError } from './errors.js';

/** Parses a request body/params with a Zod schema, or throws a ValidationError (→ 400). */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const path = issue?.path.join('.');
  throw new ValidationError(
    path ? `${path}: ${issue?.message ?? ''}` : (issue?.message ?? 'Invalid input'),
  );
}

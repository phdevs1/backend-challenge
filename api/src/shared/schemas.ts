import { z } from 'zod';

/** ISO 8601 date-time with an explicit zone (`Z` or `+02:00`), as the contract requires. */
export const isoDateTime = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

/** Text with leading/trailing spaces removed (as a form would send it); must not end up empty. */
export const nonBlankString = z.string().trim().min(1, 'must not be empty');

import { z } from 'zod';

/** ISO 8601 date-time with an explicit zone (`Z` or `+02:00`), as the contract requires. */
export const isoDateTime = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

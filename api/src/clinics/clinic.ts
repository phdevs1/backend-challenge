export interface Clinic {
  id: string;
  name: string;
  /** IANA time zone, e.g. Europe/Madrid or Atlantic/Canary. */
  timezone: string;
}

/**
 * True for IANA zone names known to the runtime (Europe/Madrid, Atlantic/Canary, UTC…).
 * Fixed offsets like "+01:00" are rejected: they ignore daylight saving time.
 */
export function isValidTimeZone(timezone: string): boolean {
  if (!/^[A-Za-z]/.test(timezone)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

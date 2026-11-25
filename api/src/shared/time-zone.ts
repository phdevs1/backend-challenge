/** Wall-clock reading of an instant in some time zone (what a clock on the wall would show). */
export interface LocalDateTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function readParts(date: Date, timeZone: string): Record<string, number> {
  const parts: Record<string, number> = {};
  for (const { type, value } of formatterFor(timeZone).formatToParts(date)) {
    if (type !== 'literal') parts[type] = Number(value);
  }
  return parts;
}

/** The wall-clock date and time that `date` shows in `timeZone`. */
export function toLocal(date: Date, timeZone: string): LocalDateTime {
  const { year, month, day, hour, minute } = readParts(date, timeZone);
  return {
    year: year ?? 0,
    month: month ?? 0,
    day: day ?? 0,
    hour: hour ?? 0,
    minute: minute ?? 0,
  };
}

/** Milliseconds that `timeZone` is ahead of UTC at the instant `utcMs` (DST included). */
function offsetMs(utcMs: number, timeZone: string): number {
  const second = Math.floor(utcMs / 1000) * 1000;
  const p = readParts(new Date(second), timeZone);
  const asUtc = Date.UTC(p.year ?? 0, (p.month ?? 1) - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - second;
}

/**
 * The instant at which `timeZone`'s wall clock shows `local`. In the hour that does not exist
 * (clocks going forward) it returns the instant just after the jump; in the hour that happens
 * twice (clocks going back) it returns the first of the two.
 */
export function fromLocal(local: LocalDateTime, timeZone: string): Date {
  const wallAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const firstGuess = wallAsUtc - offsetMs(wallAsUtc, timeZone);
  return new Date(wallAsUtc - offsetMs(firstGuess, timeZone));
}

/** The same wall-clock time `days` calendar days later (negative: earlier), not 24h-multiples. */
export function addCalendarDays(local: LocalDateTime, days: number): LocalDateTime {
  const moved = new Date(
    Date.UTC(local.year, local.month - 1, local.day + days, local.hour, local.minute),
  );
  return {
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: moved.getUTCDate(),
    hour: moved.getUTCHours(),
    minute: moved.getUTCMinutes(),
  };
}

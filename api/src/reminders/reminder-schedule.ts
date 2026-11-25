import { addCalendarDays, fromLocal, toLocal } from '../shared/time-zone.js';

/** Nothing is sent from 21:00 (included) until 09:00 (clinic time). */
const QUIET_FROM_HOUR = 21;
const QUIET_UNTIL_HOUR = 9;

export interface ReminderScheduleInput {
  startsAt: Date;
  /** IANA zone of the clinic. */
  timeZone: string;
  /** Service time when the appointment is created or rescheduled. */
  now: Date;
}

export interface ReminderSchedule {
  scheduledFor: Date;
  /** The send time is not before the appointment: the reminder is created as `skipped`/`too_late`. */
  tooLate: boolean;
}

/**
 * When the reminder of an appointment goes out:
 * 1. Same local time the day before, in the clinic's zone (so it follows DST changes).
 * 2. If that moment already passed, now.
 * 3. Never inside the quiet hours: it moves to the next 09:00 local.
 * 4. If the result is not before the appointment starts, it is too late.
 */
export function computeReminderSchedule({
  startsAt,
  timeZone,
  now,
}: ReminderScheduleInput): ReminderSchedule {
  const dayBefore = fromLocal(addCalendarDays(toLocal(startsAt, timeZone), -1), timeZone);
  const candidate = dayBefore < now ? now : dayBefore;
  const scheduledFor = outOfQuietHours(candidate, timeZone);
  return { scheduledFor, tooLate: scheduledFor >= startsAt };
}

function outOfQuietHours(instant: Date, timeZone: string): Date {
  const local = toLocal(instant, timeZone);
  if (local.hour >= QUIET_UNTIL_HOUR && local.hour < QUIET_FROM_HOUR) return instant;

  const nextDay = local.hour >= QUIET_FROM_HOUR ? 1 : 0;
  return fromLocal(
    { ...addCalendarDays(local, nextDay), hour: QUIET_UNTIL_HOUR, minute: 0 },
    timeZone,
  );
}

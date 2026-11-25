import { addCalendarDays, fromLocal, toLocal } from '../shared/time-zone.js';

/** Reminders go out from 09:00 to 21:00 (clinic time), both ends included; nothing outside. */
const OPENS_AT_HOUR = 9;
const CLOSES_AT_HOUR = 21;

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
 * 3. Never outside 09:00-21:00 local (both included): it moves to the next 09:00.
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
  const opens = fromLocal({ ...local, hour: OPENS_AT_HOUR, minute: 0 }, timeZone);
  const closes = fromLocal({ ...local, hour: CLOSES_AT_HOUR, minute: 0 }, timeZone);

  if (instant < opens) return opens;
  if (instant <= closes) return instant;
  return fromLocal({ ...addCalendarDays(local, 1), hour: OPENS_AT_HOUR, minute: 0 }, timeZone);
}

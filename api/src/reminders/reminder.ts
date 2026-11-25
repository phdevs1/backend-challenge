import type { ReminderSchedule } from './reminder-schedule.js';

export type ReminderStatus = 'pending' | 'sent' | 'failed' | 'skipped' | 'cancelled';
export type SkipReason = 'too_late' | 'no_phone' | 'opted_out';

export interface Reminder {
  id: string;
  scheduledFor: Date;
  status: ReminderStatus;
  /** Calls made to the messaging provider. */
  attempts: number;
  sentAt: Date | null;
  skipReason: SkipReason | null;
}

/** A reminder about to be stored: pending, or already skipped because it is too late. */
export interface NewReminder {
  scheduledFor: Date;
  status: 'pending' | 'skipped';
  skipReason: 'too_late' | null;
}

export function initialReminder({ scheduledFor, tooLate }: ReminderSchedule): NewReminder {
  return tooLate
    ? { scheduledFor, status: 'skipped', skipReason: 'too_late' }
    : { scheduledFor, status: 'pending', skipReason: null };
}

import type { SkipReason } from './reminder.js';

/** What the messaging provider answered, reduced to what we do next. */
export type SendOutcome =
  /** Delivered (202, or 200 if it already had it): the reminder is `sent`. */
  | 'delivered'
  /** Not delivered, or maybe delivered (503, 504, network error, timeout): try again later. */
  | 'retry'
  /** Rejected (422): the reminder is `failed`, no retries. */
  | 'rejected';

export type AttemptResult =
  | { status: 'sent'; sentAt: Date }
  | { status: 'failed' }
  | { status: 'pending'; nextAttemptAt: Date };

/** Waits after the 1st and after the 2nd failed attempt; a 3rd failure ends in `failed`. */
const RETRY_DELAYS_MS = [60_000, 5 * 60_000];

export interface SendTimeFacts {
  startsAt: Date;
  now: Date;
  phone: string | null;
  acceptsReminders: boolean;
}

/**
 * Why a reminder that is due must not be sent after all (checked on every attempt, retries
 * included), or null when it can go out. The appointment having started wins over the patient.
 */
export function skipReasonAtSendTime({
  startsAt,
  now,
  phone,
  acceptsReminders,
}: SendTimeFacts): SkipReason | null {
  if (now >= startsAt) return 'too_late';
  if (!acceptsReminders) return 'opted_out';
  if (!phone) return 'no_phone';
  return null;
}

/** What happens to a reminder after its `attemptNumber`-th call to the provider (1-based). */
export function resultOfAttempt(
  outcome: SendOutcome,
  attemptNumber: number,
  now: Date,
): AttemptResult {
  if (outcome === 'delivered') return { status: 'sent', sentAt: now };
  if (outcome === 'rejected') return { status: 'failed' };

  const delay = RETRY_DELAYS_MS[attemptNumber - 1];
  if (delay === undefined) return { status: 'failed' };
  return { status: 'pending', nextAttemptAt: new Date(now.getTime() + delay) };
}

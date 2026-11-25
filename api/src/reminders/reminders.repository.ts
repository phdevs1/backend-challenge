import type { PrismaClient } from '../shared/db/prisma.js';
import type { AttemptResult } from './delivery.js';
import type { DueReminder, SkipReason } from './reminder.js';

/** A pass that dies keeps its reminders locked this long (real time), then another pass takes them. */
const LOCK_SECONDS = 60;

export class RemindersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Takes up to `limit` pending reminders that are due at `now` and not held by another pass.
   * One statement with SKIP LOCKED: two passes never get the same reminder.
   */
  async claimDue(now: Date, limit: number): Promise<DueReminder[]> {
    const claimed = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE reminders
      SET locked_until = now() + ${LOCK_SECONDS} * interval '1 second'
      WHERE id IN (
        SELECT id FROM reminders
        WHERE status = 'pending'
          AND ((next_attempt_at IS NULL AND scheduled_for <= ${now}::timestamptz)
               OR next_attempt_at <= ${now}::timestamptz)
          AND (locked_until IS NULL OR locked_until < now())
        ORDER BY scheduled_for
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id`;
    if (claimed.length === 0) return [];

    const rows = await this.prisma.reminder.findMany({
      where: { id: { in: claimed.map((row) => row.id) } },
      select: {
        id: true,
        attempts: true,
        appointment: {
          select: {
            startsAt: true,
            clinic: { select: { name: true, timezone: true } },
            patient: { select: { name: true, phone: true, acceptsReminders: true } },
          },
        },
      },
    });
    return rows.map(({ id, attempts, appointment }) => ({
      id,
      attempts,
      startsAt: appointment.startsAt,
      timeZone: appointment.clinic.timezone,
      clinicName: appointment.clinic.name,
      patientName: appointment.patient.name,
      phone: appointment.patient.phone,
      acceptsReminders: appointment.patient.acceptsReminders,
    }));
  }

  /** Only touches a reminder that is still pending (it may have been cancelled meanwhile). */
  async finishSkipped(id: string, skipReason: SkipReason): Promise<void> {
    await this.prisma.reminder.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'skipped', skipReason, lockedUntil: null },
    });
  }

  /** Records one more provider call and its result. */
  async finishAttempt(id: string, result: AttemptResult): Promise<void> {
    const common = { attempts: { increment: 1 }, lockedUntil: null };
    const data =
      result.status === 'sent'
        ? { ...common, status: 'sent' as const, sentAt: result.sentAt, nextAttemptAt: null }
        : result.status === 'failed'
          ? { ...common, status: 'failed' as const, nextAttemptAt: null }
          : { ...common, nextAttemptAt: result.nextAttemptAt };
    await this.prisma.reminder.updateMany({ where: { id, status: 'pending' }, data });
  }
}

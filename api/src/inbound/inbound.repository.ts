import { cancelWithPendingReminder } from '../appointments/appointments.repository.js';
import type { PrismaClient } from '../shared/db/prisma.js';
import type { PatientReply } from './reply.js';

export interface InboundReply {
  messageId: string;
  /** Phone the answer came from. */
  from: string;
  /** What the patient said, or null when the text is neither SI nor NO. */
  reply: PatientReply | null;
  /** Service time: appointments that already started are not touched. */
  now: Date;
}

export class InboundRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Handles one provider message atomically: it is remembered by `messageId` (a repeated notice
   * does nothing) and, if it is a SI or NO, applied to the appointment that received the last
   * reminder sent to that phone, among those that have not started and are not cancelled.
   * If anything fails, nothing is remembered, so the provider's retry is processed.
   */
  async apply({ messageId, from, reply, now }: InboundReply): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const first = await tx.inboundMessage.createMany({
        data: { messageId },
        skipDuplicates: true,
      });
      if (first.count === 0 || reply === null) return;

      const lastSent = await tx.reminder.findFirst({
        where: {
          status: 'sent',
          appointment: {
            status: { not: 'cancelled' },
            startsAt: { gt: now },
            patient: { phone: from },
          },
        },
        orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
        select: { appointmentId: true },
      });
      if (!lastSent) return;

      if (reply === 'cancel') {
        await cancelWithPendingReminder(tx, lastSent.appointmentId);
      } else {
        await tx.appointment.update({
          where: { id: lastSent.appointmentId },
          data: { status: 'confirmed' },
        });
      }
    });
  }
}

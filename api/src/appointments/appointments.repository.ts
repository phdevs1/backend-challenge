import type { NewReminder } from '../reminders/reminder.js';
import type { Prisma } from '../shared/db/generated/client.js';
import type { PrismaClient } from '../shared/db/prisma.js';
import type { Appointment } from './appointment.js';

const appointmentSelect = {
  id: true,
  clinicId: true,
  patientId: true,
  startsAt: true,
  status: true,
  reminders: {
    select: {
      id: true,
      scheduledFor: true,
      status: true,
      attempts: true,
      sentAt: true,
      skipReason: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.AppointmentSelect;

export interface NewAppointment {
  clinicId: string;
  patientId: string;
  startsAt: Date;
}

/** The appointment and its reminders are one unit: every change to both happens in one transaction. */
export class AppointmentsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: NewAppointment, reminder: NewReminder): Promise<Appointment> {
    return this.prisma.appointment.create({
      data: { ...data, reminders: { create: reminder } },
      select: appointmentSelect,
    });
  }

  findById(id: string): Promise<Appointment | null> {
    return this.prisma.appointment.findUnique({ where: { id }, select: appointmentSelect });
  }

  /**
   * Moves the appointment, cancels its pending reminder and adds the new one. Returns null when the
   * appointment was cancelled in the meantime (nothing is changed).
   */
  reschedule(id: string, startsAt: Date, reminder: NewReminder): Promise<Appointment | null> {
    return this.prisma.$transaction(async (tx) => {
      const moved = await tx.appointment.updateMany({
        where: { id, status: { not: 'cancelled' } },
        data: { startsAt, status: 'scheduled' },
      });
      if (moved.count === 0) return null;

      await tx.reminder.updateMany({
        where: { appointmentId: id, status: 'pending' },
        data: { status: 'cancelled' },
      });
      await tx.reminder.create({ data: { appointmentId: id, ...reminder } });
      return tx.appointment.findUnique({ where: { id }, select: appointmentSelect });
    });
  }

  /** Cancels the appointment and its pending reminder. Cancelling twice changes nothing. */
  cancel(id: string): Promise<Appointment | null> {
    return this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.appointment.updateMany({
        where: { id, status: { not: 'cancelled' } },
        data: { status: 'cancelled' },
      });
      if (cancelled.count > 0) {
        await tx.reminder.updateMany({
          where: { appointmentId: id, status: 'pending' },
          data: { status: 'cancelled' },
        });
      }
      return tx.appointment.findUnique({ where: { id }, select: appointmentSelect });
    });
  }
}

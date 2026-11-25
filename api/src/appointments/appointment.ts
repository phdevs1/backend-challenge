import type { Reminder } from '../reminders/reminder.js';

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'cancelled';

export interface Appointment {
  id: string;
  clinicId: string;
  patientId: string;
  startsAt: Date;
  status: AppointmentStatus;
  /** All its reminders, oldest first. */
  reminders: Reminder[];
}

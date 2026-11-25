import type { ClinicsRepository } from '../clinics/clinics.repository.js';
import type { PatientsRepository } from '../patients/patients.repository.js';
import { initialReminder, type NewReminder } from '../reminders/reminder.js';
import { computeReminderSchedule } from '../reminders/reminder-schedule.js';
import type { Clock } from '../shared/clock.js';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';
import type { Appointment } from './appointment.js';
import type { AppointmentsRepository } from './appointments.repository.js';

export interface CreateAppointmentInput {
  clinicId: string;
  patientId: string;
  startsAt: Date;
}

export class AppointmentsService {
  constructor(
    private readonly appointments: AppointmentsRepository,
    private readonly clinics: ClinicsRepository,
    private readonly patients: PatientsRepository,
    private readonly clock: Clock,
  ) {}

  async create(input: CreateAppointmentInput): Promise<Appointment> {
    const clinic = await this.clinics.findById(input.clinicId);
    if (!clinic) throw new NotFoundError('Clinic not found');
    const patient = await this.patients.findById(input.patientId);
    if (!patient) throw new NotFoundError('Patient not found');
    if (patient.clinicId !== clinic.id) {
      throw new ValidationError('The patient does not belong to that clinic');
    }

    const now = this.clock.now();
    assertInTheFuture(input.startsAt, now);
    return this.appointments.create(input, this.reminderFor(input.startsAt, clinic.timezone, now));
  }

  async get(id: string): Promise<Appointment> {
    return this.getOrFail(id);
  }

  async reschedule(id: string, startsAt: Date): Promise<Appointment> {
    const appointment = await this.getOrFail(id);
    const now = this.clock.now();
    if (appointment.status === 'cancelled') throw new ConflictError('The appointment is cancelled');
    if (appointment.startsAt <= now) throw new ConflictError('The appointment already started');
    assertInTheFuture(startsAt, now);

    const clinic = await this.clinics.findById(appointment.clinicId);
    if (!clinic) throw new NotFoundError('Clinic not found');

    const rescheduled = await this.appointments.reschedule(
      id,
      startsAt,
      this.reminderFor(startsAt, clinic.timezone, now),
    );
    if (!rescheduled) throw new ConflictError('The appointment is cancelled');
    return rescheduled;
  }

  async cancel(id: string): Promise<Appointment> {
    const cancelled = await this.appointments.cancel(id);
    if (!cancelled) throw new NotFoundError('Appointment not found');
    return cancelled;
  }

  private async getOrFail(id: string): Promise<Appointment> {
    const appointment = await this.appointments.findById(id);
    if (!appointment) throw new NotFoundError('Appointment not found');
    return appointment;
  }

  private reminderFor(startsAt: Date, timeZone: string, now: Date): NewReminder {
    return initialReminder(computeReminderSchedule({ startsAt, timeZone, now }));
  }
}

function assertInTheFuture(startsAt: Date, now: Date): void {
  if (startsAt <= now) throw new ValidationError('startsAt must be in the future');
}

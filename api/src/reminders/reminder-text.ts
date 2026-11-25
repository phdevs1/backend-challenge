import { toLocal } from '../shared/time-zone.js';

export interface ReminderTextInput {
  patientName: string;
  clinicName: string;
  startsAt: Date;
  timeZone: string;
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** Exact text required by the contract, with the clinic's local date and time. */
export function reminderText({
  patientName,
  clinicName,
  startsAt,
  timeZone,
}: ReminderTextInput): string {
  const { day, month, year, hour, minute } = toLocal(startsAt, timeZone);
  return (
    `Hola ${patientName}, te recordamos tu cita en ${clinicName} el ` +
    `${pad(day)}/${pad(month)}/${year} a las ${pad(hour)}:${pad(minute)}. ` +
    'Responde SI para confirmar o NO para cancelar.'
  );
}

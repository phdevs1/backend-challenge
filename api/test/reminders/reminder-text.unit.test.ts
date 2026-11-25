import { expect, it } from 'vitest';
import { reminderText } from '../../src/reminders/reminder-text.js';

it('writes the exact text with the local date and time of the clinic', () => {
  // 28/03/2027 08:00 UTC is 10:00 in Madrid (after the clock change).
  expect(
    reminderText({
      patientName: 'Ana',
      clinicName: 'Clínica Dental Sonrisa',
      startsAt: new Date('2027-03-28T08:00:00Z'),
      timeZone: 'Europe/Madrid',
    }),
  ).toBe(
    'Hola Ana, te recordamos tu cita en Clínica Dental Sonrisa el 28/03/2027 a las 10:00. ' +
      'Responde SI para confirmar o NO para cancelar.',
  );
});

import { describe, expect, it } from 'vitest';
import { computeReminderSchedule } from '../../src/reminders/reminder-schedule.js';

const at = (iso: string): Date => new Date(iso);
const longAgo = at('2027-01-01T00:00:00Z');

function schedule(startsAt: string, timeZone: string, now = longAgo) {
  const { scheduledFor, tooLate } = computeReminderSchedule({
    startsAt: at(startsAt),
    timeZone,
    now,
  });
  return { scheduledFor: scheduledFor.toISOString(), tooLate };
}

describe('reminder send time', () => {
  it('is the same local time the day before, across the March clock change', () => {
    // Sunday 28/03/2027 10:00 Madrid -> Saturday 27/03/2027 10:00 Madrid (09:00 UTC): 23h earlier.
    expect(schedule('2027-03-28T08:00:00Z', 'Europe/Madrid')).toEqual({
      scheduledFor: '2027-03-27T09:00:00.000Z',
      tooLate: false,
    });
  });

  it('is the same local time the day before, across the October clock change', () => {
    // Sunday 31/10/2027 10:00 Madrid (09:00 UTC) -> Saturday 30/10 10:00 Madrid (08:00 UTC): 25h.
    expect(schedule('2027-10-31T09:00:00Z', 'Europe/Madrid').scheduledFor).toBe(
      '2027-10-30T08:00:00.000Z',
    );
  });

  it("uses the clinic's zone: the Canary Islands are one hour behind Madrid", () => {
    // 10/06/2027 11:00 Canary (10:00 UTC) -> 09/06/2027 11:00 Canary (10:00 UTC).
    expect(schedule('2027-06-10T10:00:00Z', 'Atlantic/Canary').scheduledFor).toBe(
      '2027-06-09T10:00:00.000Z',
    );
  });

  it('moves to 09:00 when it falls before 09:00', () => {
    // Appointment 08:00 Madrid: the day before at 08:00 is quiet -> 09:00 that same day.
    expect(schedule('2027-06-10T06:00:00Z', 'Europe/Madrid').scheduledFor).toBe(
      '2027-06-09T07:00:00.000Z',
    );
  });

  it('moves to 09:00 of the next day when it falls from 21:00', () => {
    // Appointment 22:00 Madrid: the day before at 22:00 is quiet -> 09:00 of the appointment day.
    expect(schedule('2027-06-10T20:00:00Z', 'Europe/Madrid').scheduledFor).toBe(
      '2027-06-10T07:00:00.000Z',
    );
  });

  it('is now when the day-before moment already passed', () => {
    // Appointment 10/06 10:00 Madrid, created 09/06 at 12:00 Madrid.
    const now = at('2027-06-09T10:00:00Z');
    expect(schedule('2027-06-10T08:00:00Z', 'Europe/Madrid', now)).toEqual({
      scheduledFor: '2027-06-09T10:00:00.000Z',
      tooLate: false,
    });
  });

  it('applies the quiet hours also to "now"', () => {
    // Created 09/06 at 21:30 Madrid for 10/06 14:00 Madrid -> 09:00 on 10/06.
    const now = at('2027-06-09T19:30:00Z');
    expect(schedule('2027-06-10T12:00:00Z', 'Europe/Madrid', now)).toEqual({
      scheduledFor: '2027-06-10T07:00:00.000Z',
      tooLate: false,
    });
  });

  it('is too late when the result is not before the appointment', () => {
    // Created 09/06 at 22:00 Madrid for 10/06 07:00 Madrid: the next 09:00 is after the start.
    const now = at('2027-06-09T20:00:00Z');
    expect(schedule('2027-06-10T05:00:00Z', 'Europe/Madrid', now)).toEqual({
      scheduledFor: '2027-06-10T07:00:00.000Z',
      tooLate: true,
    });
  });
});

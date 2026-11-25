import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestApp } from '../helpers/test-app.js';

const { app, clock, provider } = useTestApp();

interface ReminderBody {
  id: string;
  scheduledFor: string;
  status: string;
  attempts: number;
  sentAt: string | null;
  skipReason: string | null;
}

// Appointment 28/03/2027 10:00 Madrid: its reminder is due 27/03/2027 at 09:00 UTC.
const STARTS_AT = '2027-03-28T08:00:00Z';
const DUE = new Date('2027-03-27T09:00:00Z');
const minutesAfterDue = (minutes: number): Date => new Date(DUE.getTime() + minutes * 60_000);

async function setUp(patient: Record<string, unknown> = {}): Promise<string> {
  clock.set(new Date('2027-03-01T08:00:00Z'));
  const clinic = await request(app)
    .post('/clinics')
    .send({ name: 'Clínica Dental Sonrisa', timezone: 'Europe/Madrid' });
  const clinicId = (clinic.body as { id: string }).id;
  const created = await request(app)
    .post('/patients')
    .send({ clinicId, name: 'Ana', phone: '+34600111222', acceptsReminders: true, ...patient });
  const patientId = (created.body as { id: string }).id;
  const appointment = await request(app)
    .post('/appointments')
    .send({ clinicId, patientId, startsAt: STARTS_AT });
  return (appointment.body as { id: string }).id;
}

async function runJob(at: Date): Promise<number> {
  clock.set(at);
  const res = await request(app).post('/jobs/reminders/run');
  expect(res.status).toBe(200);
  return (res.body as { processed: number }).processed;
}

async function reminders(appointmentId: string): Promise<ReminderBody[]> {
  const res = await request(app).get(`/appointments/${appointmentId}`);
  return (res.body as { reminders: ReminderBody[] }).reminders;
}

let appointmentId: string;

describe('POST /jobs/reminders/run', () => {
  beforeEach(async () => {
    provider.calls.length = 0;
    provider.delivered.length = 0;
    appointmentId = await setUp();
  });

  it('sends the reminder when it is due, with the exact text, and marks it sent', async () => {
    expect(await runJob(DUE)).toBe(1);

    expect(provider.delivered).toEqual([
      {
        to: '+34600111222',
        text:
          'Hola Ana, te recordamos tu cita en Clínica Dental Sonrisa el 28/03/2027 a las 10:00. ' +
          'Responde SI para confirmar o NO para cancelar.',
        idempotencyKey: expect.any(String),
      },
    ]);
    expect(await reminders(appointmentId)).toEqual([
      expect.objectContaining({
        status: 'sent',
        attempts: 1,
        sentAt: DUE.toISOString(),
        skipReason: null,
      }),
    ]);
  });

  it('does nothing before the reminder is due', async () => {
    expect(await runJob(minutesAfterDue(-1))).toBe(0);
    expect(provider.calls).toHaveLength(0);
    expect((await reminders(appointmentId))[0]).toMatchObject({ status: 'pending', attempts: 0 });
  });

  it('does not send the reminder of a cancelled appointment', async () => {
    await request(app).post(`/appointments/${appointmentId}/cancel`);
    expect(await runJob(DUE)).toBe(0);
    expect(provider.calls).toHaveLength(0);
  });

  it('skips it with too_late when the appointment already started, without calling the provider', async () => {
    expect(await runJob(new Date('2027-03-28T08:00:00Z'))).toBe(1);
    expect(provider.calls).toHaveLength(0);
    expect((await reminders(appointmentId))[0]).toMatchObject({
      status: 'skipped',
      skipReason: 'too_late',
    });
  });

  it('retries a 503 after 1 minute, then after 5 more, and ends failed after the third attempt', async () => {
    provider.failNext('unavailable', 'unavailable', 'unavailable');

    expect(await runJob(DUE)).toBe(1);
    expect((await reminders(appointmentId))[0]).toMatchObject({ status: 'pending', attempts: 1 });

    expect(await runJob(minutesAfterDue(0.9))).toBe(0); // 54 s later: too early
    expect(await runJob(minutesAfterDue(1))).toBe(1);
    expect((await reminders(appointmentId))[0]).toMatchObject({ status: 'pending', attempts: 2 });

    expect(await runJob(minutesAfterDue(5.9))).toBe(0); // 4 min 54 s after the 2nd: too early
    expect(await runJob(minutesAfterDue(6))).toBe(1);
    expect((await reminders(appointmentId))[0]).toMatchObject({ status: 'failed', attempts: 3 });

    expect(await runJob(minutesAfterDue(60))).toBe(0);
    expect(provider.calls).toHaveLength(3);
    expect(provider.delivered).toHaveLength(0);
  });

  it('is sent when a retry succeeds', async () => {
    provider.failNext('unavailable');
    await runJob(DUE);
    await runJob(minutesAfterDue(1));
    expect((await reminders(appointmentId))[0]).toMatchObject({
      status: 'sent',
      attempts: 2,
      sentAt: minutesAfterDue(1).toISOString(),
    });
  });

  it('does not deliver twice when the provider delivered but its answer was lost (504)', async () => {
    provider.failNext('lost-response');
    await runJob(DUE);
    await runJob(minutesAfterDue(1));

    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[1]?.idempotencyKey).toBe(provider.calls[0]?.idempotencyKey);
    expect(provider.delivered).toHaveLength(1);
    expect((await reminders(appointmentId))[0]).toMatchObject({ status: 'sent', attempts: 2 });
  });

  it('is failed without retries when the provider rejects it (422)', async () => {
    provider.failNext('reject');
    await runJob(DUE);
    expect(await runJob(minutesAfterDue(60))).toBe(0);

    expect(provider.calls).toHaveLength(1);
    expect((await reminders(appointmentId))[0]).toMatchObject({ status: 'failed', attempts: 1 });
  });

  it('skips a retry with too_late when the appointment started meanwhile', async () => {
    provider.failNext('unavailable');
    await runJob(DUE);
    expect(await runJob(new Date('2027-03-28T08:00:00Z'))).toBe(1);

    expect(provider.calls).toHaveLength(1);
    expect((await reminders(appointmentId))[0]).toMatchObject({
      status: 'skipped',
      skipReason: 'too_late',
      attempts: 1,
    });
  });

  it('sends the reminder only once when several passes run at the same time', async () => {
    clock.set(DUE);
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => request(app).post('/jobs/reminders/run')),
    );

    const processed = responses.map((res) => (res.body as { processed: number }).processed);
    expect(processed.reduce((sum, n) => sum + n, 0)).toBe(1);
    expect(provider.calls).toHaveLength(1);
    expect(provider.delivered).toHaveLength(1);
  });
});

describe('reminders of patients that cannot be reminded', () => {
  beforeEach(() => {
    provider.calls.length = 0;
  });

  it.each([
    ['has no phone', { phone: null }, 'no_phone'],
    ['does not accept reminders', { acceptsReminders: false }, 'opted_out'],
  ])(
    'skips it when the patient %s, without calling the provider',
    async (_case, patient, reason) => {
      const id = await setUp(patient);
      expect(await runJob(DUE)).toBe(1);

      expect(provider.calls).toHaveLength(0);
      expect((await reminders(id))[0]).toMatchObject({
        status: 'skipped',
        skipReason: reason,
        attempts: 0,
      });
    },
  );
});

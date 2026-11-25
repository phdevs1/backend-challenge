import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestApp } from '../helpers/test-app.js';

const { app, clock } = useTestApp();

const PHONE = '+34600111222';
const at = (iso: string): Date => new Date(iso);

// Appointment A: 28/03/2027 10:00 Madrid, reminder due 27/03 09:00 UTC.
// Appointment B: only used as a new time to reschedule to.
// Appointment LATER: 28/03/2027 14:00 Madrid; its reminder is due 27/03 14:00 Madrid (13:00 UTC, still
// winter time), after A's, while A has not started yet.
const A = { startsAt: '2027-03-28T08:00:00Z', due: at('2027-03-27T09:00:00Z') };
const B = { startsAt: '2027-03-30T08:00:00Z' };
const LATER = { startsAt: '2027-03-28T12:00:00Z', due: at('2027-03-27T13:00:00Z') };

let clinicId: string;
let messageCount = 0;

async function createPatient(name: string, phone: string | null = PHONE): Promise<string> {
  const res = await request(app)
    .post('/patients')
    .send({ clinicId, name, phone, acceptsReminders: true });
  return (res.body as { id: string }).id;
}

async function createAppointment(patientId: string, startsAt: string): Promise<string> {
  const res = await request(app).post('/appointments').send({ clinicId, patientId, startsAt });
  return (res.body as { id: string }).id;
}

async function runJob(time: Date): Promise<void> {
  clock.set(time);
  await request(app).post('/jobs/reminders/run');
}

async function appointment(id: string) {
  const res = await request(app).get(`/appointments/${id}`);
  return res.body as { status: string; reminders: { status: string }[] };
}

async function reply(text: string, overrides: Record<string, unknown> = {}) {
  messageCount += 1;
  return request(app)
    .post('/webhooks/inbound-messages')
    .send({
      messageId: `msg-${messageCount}`,
      from: PHONE,
      text,
      receivedAt: clock.now().toISOString(),
      ...overrides,
    });
}

beforeEach(async () => {
  clock.set(at('2027-03-01T08:00:00Z'));
  const clinic = await request(app)
    .post('/clinics')
    .send({ name: 'Clínica Dental Sonrisa', timezone: 'Europe/Madrid' });
  clinicId = (clinic.body as { id: string }).id;
});

describe('POST /webhooks/inbound-messages', () => {
  it.each(['SI', 'sí', ' Si. '])(
    'confirms the appointment when the patient answers %j',
    async (text) => {
      const id = await createAppointment(await createPatient('Ana'), A.startsAt);
      await runJob(A.due);

      const res = await reply(text);
      expect(res.status).toBe(200);
      expect((await appointment(id)).status).toBe('confirmed');
    },
  );

  it('cancels the appointment and its pending reminder when the patient answers NO', async () => {
    const id = await createAppointment(await createPatient('Ana'), A.startsAt);
    await runJob(A.due);
    // Rescheduled after the reminder went out: a new reminder is pending.
    await request(app).patch(`/appointments/${id}`).send({ startsAt: B.startsAt });

    const res = await reply('NO!');
    expect(res.status).toBe(200);
    const result = await appointment(id);
    expect(result.status).toBe('cancelled');
    expect(result.reminders.map((r) => r.status)).toEqual(['sent', 'cancelled']);
  });

  it('responds 200 and changes nothing for any other text', async () => {
    const id = await createAppointment(await createPatient('Ana'), A.startsAt);
    await runJob(A.due);

    const res = await reply('vale, gracias');
    expect(res.status).toBe(200);
    expect((await appointment(id)).status).toBe('scheduled');
  });

  it('responds 200 and ignores it when no reminder was sent to that phone', async () => {
    const id = await createAppointment(await createPatient('Ana'), A.startsAt);

    const res = await reply('SI');
    expect(res.status).toBe(200);
    expect((await appointment(id)).status).toBe('scheduled');
  });

  it('applies the answer to the appointment of the last reminder sent to that phone (a family)', async () => {
    const a = await createAppointment(await createPatient('Ana'), A.startsAt);
    const b = await createAppointment(await createPatient('Pablo'), LATER.startsAt);
    await runJob(A.due);
    await runJob(LATER.due);

    await reply('SI');
    expect((await appointment(b)).status).toBe('confirmed');
    expect((await appointment(a)).status).toBe('scheduled');
  });

  it('skips appointments that are cancelled and falls back to the previous one', async () => {
    const a = await createAppointment(await createPatient('Ana'), A.startsAt);
    const b = await createAppointment(await createPatient('Pablo'), LATER.startsAt);
    await runJob(A.due);
    await runJob(LATER.due);
    await request(app).post(`/appointments/${b}/cancel`);

    await reply('SI');
    expect((await appointment(a)).status).toBe('confirmed');
  });

  it('ignores the answer when the appointment already started', async () => {
    const id = await createAppointment(await createPatient('Ana'), A.startsAt);
    await runJob(A.due);
    clock.set(at('2027-03-28T08:00:00Z'));

    const res = await reply('SI');
    expect(res.status).toBe(200);
    expect((await appointment(id)).status).toBe('scheduled');
  });

  it('processes a repeated messageId only once', async () => {
    const id = await createAppointment(await createPatient('Ana'), A.startsAt);
    await runJob(A.due);

    await reply('SI', { messageId: 'same' });
    await request(app).patch(`/appointments/${id}`).send({ startsAt: B.startsAt }); // back to scheduled
    const repeated = await reply('SI', { messageId: 'same' });

    expect(repeated.status).toBe(200);
    expect((await appointment(id)).status).toBe('scheduled');
    await reply('SI', { messageId: 'another' });
    expect((await appointment(id)).status).toBe('confirmed');
  });

  it.each([
    ['messageId is missing', { messageId: undefined }],
    ['text is missing', { text: undefined }],
    ['receivedAt has no time zone', { receivedAt: '2027-03-27T09:00:00' }],
  ])('responds 400 when %s', async (_case, overrides) => {
    const res = await reply('SI', overrides);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
  });
});

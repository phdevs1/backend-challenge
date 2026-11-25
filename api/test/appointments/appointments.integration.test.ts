import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestApp } from '../helpers/test-app.js';

const { app, prisma, clock } = useTestApp();

interface ReminderBody {
  id: string;
  scheduledFor: string;
  status: string;
  attempts: number;
  sentAt: string | null;
  skipReason: string | null;
}
interface AppointmentBody {
  id: string;
  clinicId: string;
  patientId: string;
  startsAt: string;
  status: string;
  reminders: ReminderBody[];
}

async function createClinic(timezone = 'Europe/Madrid'): Promise<string> {
  const res = await request(app)
    .post('/clinics')
    .send({ name: 'Clínica Dental Sonrisa', timezone });
  return (res.body as { id: string }).id;
}

async function createPatient(clinicId: string): Promise<string> {
  const res = await request(app)
    .post('/patients')
    .send({ clinicId, name: 'Ana', phone: '+34600111222', acceptsReminders: true });
  return (res.body as { id: string }).id;
}

async function createAppointment(
  clinicId: string,
  patientId: string,
  startsAt: string,
): Promise<AppointmentBody> {
  const res = await request(app).post('/appointments').send({ clinicId, patientId, startsAt });
  expect(res.status).toBe(201);
  return res.body as AppointmentBody;
}

let clinicId: string;
let patientId: string;

beforeEach(async () => {
  clock.set(new Date('2027-03-01T08:00:00Z'));
  clinicId = await createClinic();
  patientId = await createPatient(clinicId);
});

describe('POST /appointments', () => {
  it('creates the appointment with its pending reminder the day before at the same local time', async () => {
    const res = await request(app)
      .post('/appointments')
      .send({ clinicId, patientId, startsAt: '2027-03-28T10:00:00+02:00' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      clinicId,
      patientId,
      startsAt: '2027-03-28T08:00:00.000Z',
      status: 'scheduled',
      reminders: [
        {
          id: expect.any(String),
          scheduledFor: '2027-03-27T09:00:00.000Z',
          status: 'pending',
          attempts: 0,
          sentAt: null,
          skipReason: null,
        },
      ],
    });
  });

  it('creates the reminder as skipped/too_late when it cannot go out before the appointment', async () => {
    clock.set(new Date('2027-06-09T20:00:00Z')); // 22:00 in Madrid
    const appointment = await createAppointment(clinicId, patientId, '2027-06-10T05:00:00Z');

    expect(appointment.reminders).toEqual([
      expect.objectContaining({ status: 'skipped', skipReason: 'too_late', attempts: 0 }),
    ]);
  });

  it.each([
    ['startsAt is not in the future', { startsAt: '2027-03-01T08:00:00Z' }],
    ['startsAt has no time zone', { startsAt: '2027-03-28T10:00:00' }],
    ['startsAt is missing', { startsAt: undefined }],
  ])('responds 400 when %s', async (_case, override) => {
    const res = await request(app)
      .post('/appointments')
      .send({ clinicId, patientId, ...override });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
  });

  it('responds 400 when the patient belongs to another clinic', async () => {
    const otherClinicId = await createClinic();
    const res = await request(app)
      .post('/appointments')
      .send({ clinicId: otherClinicId, patientId, startsAt: '2027-03-28T08:00:00Z' });
    expect(res.status).toBe(400);
  });

  it.each([
    ['clinic', { clinicId: 'nope' }],
    ['patient', { patientId: 'nope' }],
  ])('responds 404 when the %s does not exist', async (_case, override) => {
    const res = await request(app)
      .post('/appointments')
      .send({ clinicId, patientId, startsAt: '2027-03-28T08:00:00Z', ...override });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: expect.any(String) });
  });
});

describe('GET /appointments/:id', () => {
  it('returns the appointment with its reminders', async () => {
    const created = await createAppointment(clinicId, patientId, '2027-03-28T08:00:00Z');
    const res = await request(app).get(`/appointments/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(created);
  });

  it('responds 404 when it does not exist', async () => {
    const res = await request(app).get('/appointments/nope');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /appointments/:id', () => {
  it('cancels the pending reminder and creates another one for the new time', async () => {
    const created = await createAppointment(clinicId, patientId, '2027-03-28T08:00:00Z');
    const res = await request(app)
      .patch(`/appointments/${created.id}`)
      .send({ startsAt: '2027-03-30T08:00:00Z' });

    expect(res.status).toBe(200);
    const body = res.body as AppointmentBody;
    expect(body.startsAt).toBe('2027-03-30T08:00:00.000Z');
    expect(body.reminders.map((r) => [r.status, r.scheduledFor])).toEqual([
      ['cancelled', '2027-03-27T09:00:00.000Z'],
      ['pending', '2027-03-29T08:00:00.000Z'],
    ]);
  });

  it('creates the new reminder even if the previous one had already been sent', async () => {
    const created = await createAppointment(clinicId, patientId, '2027-03-28T08:00:00Z');
    await prisma.reminder.update({
      where: { id: created.reminders[0]?.id ?? '' },
      data: { status: 'sent', sentAt: new Date(), attempts: 1 },
    });

    const res = await request(app)
      .patch(`/appointments/${created.id}`)
      .send({ startsAt: '2027-03-30T08:00:00Z' });

    const body = res.body as AppointmentBody;
    expect(body.reminders.map((r) => r.status)).toEqual(['sent', 'pending']);
  });

  it('goes back to scheduled when it was confirmed', async () => {
    const created = await createAppointment(clinicId, patientId, '2027-03-28T08:00:00Z');
    await prisma.appointment.update({ where: { id: created.id }, data: { status: 'confirmed' } });

    const res = await request(app)
      .patch(`/appointments/${created.id}`)
      .send({ startsAt: '2027-03-30T08:00:00Z' });

    expect((res.body as AppointmentBody).status).toBe('scheduled');
  });

  it('responds 400 when startsAt is not in the future', async () => {
    const created = await createAppointment(clinicId, patientId, '2027-03-28T08:00:00Z');
    const res = await request(app)
      .patch(`/appointments/${created.id}`)
      .send({ startsAt: '2027-03-01T07:00:00Z' });
    expect(res.status).toBe(400);
  });

  it('responds 404 when it does not exist', async () => {
    const res = await request(app)
      .patch('/appointments/nope')
      .send({ startsAt: '2027-03-30T08:00:00Z' });
    expect(res.status).toBe(404);
  });

  it('responds 409 when the appointment is cancelled', async () => {
    const created = await createAppointment(clinicId, patientId, '2027-03-28T08:00:00Z');
    await request(app).post(`/appointments/${created.id}/cancel`);
    const res = await request(app)
      .patch(`/appointments/${created.id}`)
      .send({ startsAt: '2027-03-30T08:00:00Z' });
    expect(res.status).toBe(409);
  });

  it('responds 409 when the appointment already started', async () => {
    const created = await createAppointment(clinicId, patientId, '2027-03-28T08:00:00Z');
    clock.set(new Date('2027-03-28T09:00:00Z'));
    const res = await request(app)
      .patch(`/appointments/${created.id}`)
      .send({ startsAt: '2027-03-30T08:00:00Z' });
    expect(res.status).toBe(409);
  });
});

describe('POST /appointments/:id/cancel', () => {
  it('cancels the appointment and its pending reminder', async () => {
    const created = await createAppointment(clinicId, patientId, '2027-03-28T08:00:00Z');
    const res = await request(app).post(`/appointments/${created.id}/cancel`);

    expect(res.status).toBe(200);
    const body = res.body as AppointmentBody;
    expect(body.status).toBe('cancelled');
    expect(body.reminders.map((r) => r.status)).toEqual(['cancelled']);
  });

  it('does nothing and responds 200 when it was already cancelled', async () => {
    const created = await createAppointment(clinicId, patientId, '2027-03-28T08:00:00Z');
    const first = await request(app).post(`/appointments/${created.id}/cancel`);
    const second = await request(app).post(`/appointments/${created.id}/cancel`);

    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
  });

  it('responds 404 when it does not exist', async () => {
    const res = await request(app).post('/appointments/nope/cancel');
    expect(res.status).toBe(404);
  });
});

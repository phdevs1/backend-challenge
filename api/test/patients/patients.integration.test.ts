import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestApp } from '../helpers/test-app.js';

const { app } = useTestApp();

async function createClinic(): Promise<string> {
  const res = await request(app)
    .post('/clinics')
    .send({ name: 'Clínica Dental Sonrisa', timezone: 'Europe/Madrid' });
  return (res.body as { id: string }).id;
}

describe('POST /patients', () => {
  it('creates a patient and responds 201 with it', async () => {
    const clinicId = await createClinic();
    const res = await request(app)
      .post('/patients')
      .send({ clinicId, name: 'Ana', phone: '+34600111222', acceptsReminders: true });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      clinicId,
      name: 'Ana',
      phone: '+34600111222',
      acceptsReminders: true,
    });
  });

  it('accepts a patient without phone (phone: null)', async () => {
    const clinicId = await createClinic();
    const res = await request(app)
      .post('/patients')
      .send({ clinicId, name: 'Luis', acceptsReminders: false });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ phone: null });
  });

  it('allows several patients with the same phone (a family)', async () => {
    const clinicId = await createClinic();
    const body = { clinicId, phone: '+34600111222', acceptsReminders: true };
    const first = await request(app)
      .post('/patients')
      .send({ ...body, name: 'Ana' });
    const second = await request(app)
      .post('/patients')
      .send({ ...body, name: 'Pablo' });
    expect([first.status, second.status]).toEqual([201, 201]);
  });

  it('responds 404 when the clinic does not exist', async () => {
    const res = await request(app)
      .post('/patients')
      .send({ clinicId: 'does-not-exist', name: 'Ana', phone: null, acceptsReminders: true });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: expect.any(String) });
  });

  it.each([
    ['a phone that is not E.164', { phone: '600111222' }],
    ['a missing acceptsReminders', { acceptsReminders: undefined }],
  ])('responds 400 for %s', async (_case, override) => {
    const clinicId = await createClinic();
    const res = await request(app)
      .post('/patients')
      .send({ clinicId, name: 'Ana', phone: '+34600111222', acceptsReminders: true, ...override });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
  });
});

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestApp } from '../helpers/test-app.js';

const { app } = useTestApp();

describe('POST /clinics', () => {
  it('creates a clinic and responds 201 with it', async () => {
    const res = await request(app)
      .post('/clinics')
      .send({ name: 'Clínica Dental Sonrisa', timezone: 'Europe/Madrid' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      name: 'Clínica Dental Sonrisa',
      timezone: 'Europe/Madrid',
    });
  });

  it('removes leading and trailing spaces from the name', async () => {
    const res = await request(app)
      .post('/clinics')
      .send({ name: '  Clínica Norte ', timezone: 'Europe/Madrid' });
    expect(res.body).toMatchObject({ name: 'Clínica Norte' });
  });

  it.each([
    ['a time zone that does not exist', { name: 'X', timezone: 'Europe/Atlantis' }],
    ['a missing time zone', { name: 'X' }],
    ['an empty name', { name: '  ', timezone: 'Europe/Madrid' }],
  ])('responds 400 for %s', async (_case, body) => {
    const res = await request(app).post('/clinics').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
  });
});

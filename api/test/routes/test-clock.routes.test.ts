import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { HealthController } from '../../src/controllers/health.controller.js';
import { TestClockController } from '../../src/controllers/test-clock.controller.js';
import { TestClock } from '../../src/domain/clock.js';

const health = new HealthController(() => Promise.resolve(true));

function appInTestMode() {
  const clock = new TestClock();
  const app = createApp({ health, testClock: new TestClockController(clock) });
  return { app, clock };
}

describe('PUT /test/clock', () => {
  it('fixes the service time and responds 204', async () => {
    const { app, clock } = appInTestMode();
    const res = await request(app).put('/test/clock').send({ now: '2027-03-27T09:00:00Z' });
    expect(res.status).toBe(204);
    expect(clock.now().toISOString()).toBe('2027-03-27T09:00:00.000Z');
  });

  it('accepts a time with offset and stores the same instant', async () => {
    const { app, clock } = appInTestMode();
    await request(app).put('/test/clock').send({ now: '2027-03-27T10:00:00+01:00' });
    expect(clock.now().toISOString()).toBe('2027-03-27T09:00:00.000Z');
  });

  it.each([
    ['missing now', {}],
    ['not a date', { now: 'tomorrow' }],
    ['no time zone', { now: '2027-03-27T10:00:00' }],
  ])('responds 400 when %s', async (_case, body) => {
    const { app } = appInTestMode();
    const res = await request(app).put('/test/clock').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('responds 400 on malformed JSON', async () => {
    const { app } = appInTestMode();
    const res = await request(app)
      .put('/test/clock')
      .set('content-type', 'application/json')
      .send('{"now":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Malformed JSON body' });
  });

  it('does not exist without CLOCK_MODE=test', async () => {
    const app = createApp({ health });
    const res = await request(app).put('/test/clock').send({ now: '2027-03-27T09:00:00Z' });
    expect(res.status).toBe(404);
  });
});

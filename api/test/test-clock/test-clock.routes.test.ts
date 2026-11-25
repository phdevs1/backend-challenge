import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { TestClockController } from '../../src/test-clock/test-clock.controller.js';
import { TestClock } from '../../src/shared/clock.js';
import { fakeControllers } from '../helpers/fake-controllers.js';

function appInTestMode() {
  const clock = new TestClock();
  const app = createApp(fakeControllers({ testClock: new TestClockController(clock) }));
  return { app, clock };
}

describe('PUT /test/clock', () => {
  it('fixes the service time and responds 204', async () => {
    const { app, clock } = appInTestMode();
    const res = await request(app).put('/test/clock').send({ now: '2027-03-27T09:00:00Z' });
    expect(res.status).toBe(204);
    expect(clock.now().toISOString()).toBe('2027-03-27T09:00:00.000Z');
  });

  it('accepts a time with offset (contract: ISO 8601 with zone)', async () => {
    const { app, clock } = appInTestMode();
    await request(app).put('/test/clock').send({ now: '2027-03-27T10:00:00+01:00' });
    expect(clock.now().toISOString()).toBe('2027-03-27T09:00:00.000Z');
  });

  it('does not exist without CLOCK_MODE=test', async () => {
    const res = await request(createApp(fakeControllers()))
      .put('/test/clock')
      .send({ now: '2027-03-27T09:00:00Z' });
    expect(res.status).toBe(404);
  });
});

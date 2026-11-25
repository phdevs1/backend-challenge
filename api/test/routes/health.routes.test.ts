import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { HealthController } from '../../src/controllers/health.controller.js';

const appWithDatabase = (up: boolean) =>
  createApp({ health: new HealthController(() => Promise.resolve(up)) });

describe('GET /health', () => {
  it('responds 200 when the database is up', async () => {
    const res = await request(appWithDatabase(true)).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'up', database: 'up' });
  });

  it('responds 503 when the database is down', async () => {
    const res = await request(appWithDatabase(false)).get('/health');
    expect(res.status).toBe(503);
  });

  it('answers unknown routes with the contract error shape', async () => {
    const res = await request(appWithDatabase(true)).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});

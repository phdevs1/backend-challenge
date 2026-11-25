import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { fakeControllers } from '../helpers/fake-controllers.js';

describe('GET /health', () => {
  it('responds 200 when the service is ready', async () => {
    const res = await request(createApp(fakeControllers())).get('/health');
    expect(res.status).toBe(200);
  });
});

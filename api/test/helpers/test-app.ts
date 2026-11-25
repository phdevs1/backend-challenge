import { afterAll, beforeEach } from 'vitest';
import { createApp } from '../../src/app.js';
import { TestClock } from '../../src/shared/clock.js';
import { createPrismaClient } from '../../src/shared/db/prisma.js';
import { createControllers } from '../../src/wiring.js';
import { FakeMessageProvider } from './fake-message-provider.js';
import { TEST_DATABASE_URL } from './test-database-url.js';

/**
 * The real app (same wiring as main.ts) against the test database, with a TestClock.
 * Tables are emptied before each test.
 */
export function useTestApp() {
  const prisma = createPrismaClient(TEST_DATABASE_URL);
  const clock = new TestClock();
  const provider = new FakeMessageProvider();
  const app = createApp(createControllers({ prisma, messageProvider: provider, testClock: clock }));

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE patients, clinics RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  return { app, prisma, clock, provider };
}

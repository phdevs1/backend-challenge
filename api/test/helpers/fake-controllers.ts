import { HealthController } from '../../src/health/health.controller.js';
import { createPrismaClient } from '../../src/shared/db/prisma.js';
import type { Controllers } from '../../src/wiring.js';
import { createControllers } from '../../src/wiring.js';
import { FakeMessageProvider } from './fake-message-provider.js';

// Prisma connects lazily: this client never opens a connection unless a test hits the database.
const unusedPrisma = createPrismaClient('postgresql://unused:unused@127.0.0.1:1/unused');

/** Real controllers for HTTP tests that need no database; override the ones under test. */
export function fakeControllers(overrides: Partial<Controllers> = {}): Controllers {
  return {
    ...createControllers({ prisma: unusedPrisma, messageProvider: new FakeMessageProvider() }),
    health: new HealthController(() => Promise.resolve(true)),
    ...overrides,
  };
}

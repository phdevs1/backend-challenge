import { createApp } from './app.js';
import { HealthController } from './controllers/health.controller.js';
import { TestClockController } from './controllers/test-clock.controller.js';
import { TestClock } from './domain/clock.js';
import { loadEnv } from './env.js';
import { createPrismaClient, isDatabaseUp } from './repositories/prisma.js';

// Wiring: the only place that creates concrete instances and connects them.
const env = loadEnv();
const prisma = createPrismaClient(env.DATABASE_URL);

// With CLOCK_MODE=test the whole service reads the time from a TestClock that PUT /test/clock
// moves. Services will receive `testClock ?? new SystemClock()` as their Clock.
const testClock = env.CLOCK_MODE === 'test' ? new TestClock() : undefined;

const app = createApp({
  health: new HealthController(() => isDatabaseUp(prisma)),
  testClock: testClock && new TestClockController(testClock),
});

const server = app.listen(env.PORT, () => {
  console.log(`api listening on :${env.PORT} (clock mode: ${env.CLOCK_MODE})`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});

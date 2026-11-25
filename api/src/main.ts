import { createApp } from './app.js';
import { TestClock } from './shared/clock.js';
import { loadEnv } from './env.js';
import { createPrismaClient } from './shared/db/prisma.js';
import { createControllers } from './wiring.js';

const env = loadEnv();
const prisma = createPrismaClient(env.DATABASE_URL);

// With CLOCK_MODE=test the whole service reads the time from a TestClock that PUT /test/clock
// moves. Services will receive `testClock ?? new SystemClock()` as their Clock.
const testClock = env.CLOCK_MODE === 'test' ? new TestClock() : undefined;

const app = createApp(createControllers({ prisma, testClock }));

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

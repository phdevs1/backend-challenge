import { createApp } from './app.js';
import { HealthController } from './controllers/health.controller.js';
import { loadEnv } from './env.js';
import { createPrismaClient, isDatabaseUp } from './repositories/prisma.js';

// Wiring: the only place that creates concrete instances and connects them.
const env = loadEnv();
const prisma = createPrismaClient(env.DATABASE_URL);

const app = createApp({
  health: new HealthController(() => isDatabaseUp(prisma)),
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

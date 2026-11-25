import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer loads .env by itself. Load it for local dev; in Docker/CI the
// variables come from the environment and there is no .env file.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Optional so `prisma generate` works at build time / in CI without a database.
    // `migrate` commands fail loudly if it is missing.
    url: process.env.DATABASE_URL ?? '',
  },
});

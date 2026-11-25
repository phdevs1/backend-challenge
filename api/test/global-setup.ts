import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './helpers/test-database-url.js';

/** Runs once before all tests: creates/migrates the test database. */
export default function setup(): void {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}

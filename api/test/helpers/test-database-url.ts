/**
 * Integration tests use their own database (clinicsay_test) so they never touch dev data.
 * Locally it lives in the docker compose `db` (host port 5433); CI sets TEST_DATABASE_URL.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://clinicsay:clinicsay@localhost:5433/clinicsay_test';

import { ClinicsController } from './clinics/clinics.controller.js';
import { HealthController } from './health/health.controller.js';
import { PatientsController } from './patients/patients.controller.js';
import { TestClockController } from './test-clock/test-clock.controller.js';
import type { TestClock } from './shared/clock.js';
import { ClinicsRepository } from './clinics/clinics.repository.js';
import { PatientsRepository } from './patients/patients.repository.js';
import { isDatabaseUp, type PrismaClient } from './shared/db/prisma.js';
import { ClinicsService } from './clinics/clinics.service.js';
import { PatientsService } from './patients/patients.service.js';

/** Controllers already wired; the router mounts them and tests can build them with fakes inside. */
export interface Controllers {
  health: HealthController;
  clinics: ClinicsController;
  patients: PatientsController;
  /** Only present with CLOCK_MODE=test; without it `PUT /test/clock` does not exist (404). */
  testClock?: TestClockController | undefined;
}

export interface WiringDeps {
  prisma: PrismaClient;
  /** Set only with CLOCK_MODE=test. */
  testClock?: TestClock | undefined;
}

/**
 * Composition root: the only place that creates repositories, services and controllers and
 * connects them. main.ts uses it with the real database; integration tests with the test one.
 */
export function createControllers({ prisma, testClock }: WiringDeps): Controllers {
  const clinicsRepository = new ClinicsRepository(prisma);
  const patientsRepository = new PatientsRepository(prisma);

  return {
    health: new HealthController(() => isDatabaseUp(prisma)),
    clinics: new ClinicsController(new ClinicsService(clinicsRepository)),
    patients: new PatientsController(new PatientsService(patientsRepository, clinicsRepository)),
    testClock: testClock && new TestClockController(testClock),
  };
}

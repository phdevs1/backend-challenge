import { Router } from 'express';
import { clinicsRoutes } from './clinics/clinics.routes.js';
import { healthRoutes } from './health/health.routes.js';
import { patientsRoutes } from './patients/patients.routes.js';
import { testClockRoutes } from './test-clock/test-clock.routes.js';
import type { Controllers } from './wiring.js';

/** Every route of the API. A new endpoint adds one line here. */
export function createRouter(controllers: Controllers): Router {
  const router = Router();

  router.use(healthRoutes(controllers.health));
  router.use(clinicsRoutes(controllers.clinics));
  router.use(patientsRoutes(controllers.patients));
  if (controllers.testClock) router.use(testClockRoutes(controllers.testClock));

  return router;
}

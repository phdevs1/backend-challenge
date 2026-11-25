import { Router } from 'express';
import type { HealthController } from '../controllers/health.controller.js';
import type { TestClockController } from '../controllers/test-clock.controller.js';
import { healthRoutes } from './health.routes.js';
import { testClockRoutes } from './test-clock.routes.js';

/** Controllers already wired in main.ts (tests pass their own, with fakes inside). */
export interface Controllers {
  health: HealthController;
  /** Only present with CLOCK_MODE=test; without it `PUT /test/clock` does not exist (404). */
  testClock?: TestClockController | undefined;
}

/** Every route of the API. A new endpoint adds one line here. */
export function createRouter(controllers: Controllers): Router {
  const router = Router();

  router.use(healthRoutes(controllers.health));
  if (controllers.testClock) router.use(testClockRoutes(controllers.testClock));

  return router;
}

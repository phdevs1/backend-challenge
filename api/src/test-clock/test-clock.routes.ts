import { Router } from 'express';
import type { TestClockController } from './test-clock.controller.js';

export function testClockRoutes(controller: TestClockController): Router {
  const router = Router();
  router.put('/test/clock', controller.set);
  return router;
}

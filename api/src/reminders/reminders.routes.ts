import { Router } from 'express';
import type { RemindersController } from './reminders.controller.js';

export function remindersRoutes(controller: RemindersController): Router {
  const router = Router();
  router.post('/jobs/reminders/run', controller.run);
  return router;
}

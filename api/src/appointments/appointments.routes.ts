import { Router } from 'express';
import type { AppointmentsController } from './appointments.controller.js';

export function appointmentsRoutes(controller: AppointmentsController): Router {
  const router = Router();
  router.post('/appointments', controller.create);
  router.get('/appointments/:id', controller.get);
  router.patch('/appointments/:id', controller.reschedule);
  router.post('/appointments/:id/cancel', controller.cancel);
  return router;
}

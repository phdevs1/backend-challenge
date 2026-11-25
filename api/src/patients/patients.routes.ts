import { Router } from 'express';
import type { PatientsController } from './patients.controller.js';

export function patientsRoutes(controller: PatientsController): Router {
  const router = Router();
  router.post('/patients', controller.create);
  return router;
}

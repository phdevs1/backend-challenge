import { Router } from 'express';
import type { ClinicsController } from './clinics.controller.js';

export function clinicsRoutes(controller: ClinicsController): Router {
  const router = Router();
  router.post('/clinics', controller.create);
  return router;
}

import { Router } from 'express';
import type { InboundController } from './inbound.controller.js';

export function inboundRoutes(controller: InboundController): Router {
  const router = Router();
  router.post('/webhooks/inbound-messages', controller.receive);
  return router;
}

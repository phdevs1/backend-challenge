import express, { type Express } from 'express';
import type { HealthController } from './controllers/health.controller.js';
import { errorHandler, notFoundHandler } from './routes/error-handler.js';
import { healthRoutes } from './routes/health.routes.js';

export interface Controllers {
  health: HealthController;
}

/** Builds the Express app from already-wired controllers, so tests can pass fakes. */
export function createApp(controllers: Controllers): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.use(healthRoutes(controllers.health));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

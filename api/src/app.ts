import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './shared/error-handler.js';
import { createRouter } from './routes.js';
import type { Controllers } from './wiring.js';

export function createApp(controllers: Controllers): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/', createRouter(controllers));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

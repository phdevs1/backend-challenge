import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './routes/error-handler.js';
import { createRouter, type Controllers } from './routes/index.js';

export function createApp(controllers: Controllers): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/', createRouter(controllers));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

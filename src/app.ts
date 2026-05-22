import express, { Application, urlencoded } from 'express';
import routes from './routes';
import {
  httpLogger,
  logRequestMeta,
} from './middlewares/requestLogger.middleware';
import { notFoundHandler } from './middlewares/notFoundHandler.middleware';
import { errorHandler } from './middlewares/errorHandler.middleware';

export const createApp = (): Application => {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true }));
  app.use(httpLogger);
  app.use(logRequestMeta);

  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

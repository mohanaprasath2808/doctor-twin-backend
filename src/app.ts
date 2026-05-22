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

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/v1/check', (_req, res) => {
    res.send('<h1>Doctor Twin API is running</h1>');
  });

  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

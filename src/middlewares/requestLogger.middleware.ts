import morgan from 'morgan';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export const httpLogger = morgan(env.isProduction ? 'combined' : 'dev', {
  stream,
});

export const logRequestMeta = (
  req: Request,
  _res: Response,
  next: () => void,
): void => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
  });
  next();
};

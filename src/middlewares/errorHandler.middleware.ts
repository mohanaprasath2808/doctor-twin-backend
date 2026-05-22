import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { ApiErrorResponse } from '../utils/apiResponse';

const isAppError = (err: unknown): err is AppError => err instanceof AppError;

const isJoiError = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'isJoi' in err &&
  (err as { isJoi: boolean }).isJoi === true;

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: unknown;

  if (isAppError(err)) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.details;
  } else if (isJoiError(err)) {
    statusCode = 400;
    message = 'Validation failed';
    errors = (err as { details: unknown }).details;
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (statusCode >= 500) {
    logger.error(message, { stack: err instanceof Error ? err.stack : err });
  } else {
    logger.warn(message, { statusCode, errors });
  }

  const body: ApiErrorResponse = {
    success: false,
    message,
    ...(errors !== undefined && { errors }),
    ...(!env.isProduction &&
      err instanceof Error && { stack: err.stack }),
  };

  res.status(statusCode).json(body);
};

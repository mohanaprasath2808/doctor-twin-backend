import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { ApiErrorResponse } from '../utils/apiResponse';
import { normalizeError } from '../utils/apiEnvelope';

const isAppError = (err: unknown): err is AppError => err instanceof AppError;

const isJoiError = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'isJoi' in err &&
  (err as { isJoi: boolean }).isJoi === true;

const usesAuthEnvelope = (req: Request): boolean =>
  req.originalUrl.startsWith('/auth') || req.baseUrl.startsWith('/auth');

export const errorHandler = (
  err: unknown,
  req: Request,
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
    statusCode = usesAuthEnvelope(req) ? 422 : 400;
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

  if (usesAuthEnvelope(req)) {
    const body =
      isJoiError(err) && errors
        ? {
            ok: false as const,
            error: 'Validation failed',
            meta: { issues: errors },
          }
        : normalizeError(
            typeof errors === 'object' && errors !== null
              ? { message, ...(errors as Record<string, unknown>) }
              : message,
          );
    if (statusCode >= 500) {
      body.error = 'Internal server error';
    }
    res.status(statusCode).json(body);
    return;
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

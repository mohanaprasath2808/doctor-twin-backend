import { Response } from 'express';

export interface ApiOkResponse<T = unknown> {
  ok: true;
  data: T;
}

export interface ApiFailResponse {
  ok: false;
  error: string;
  meta?: Record<string, unknown>;
}

export const successResponse = <T>(data: T): ApiOkResponse<T> => ({
  ok: true,
  data,
});

export const normalizeError = (
  detail: string | Record<string, unknown>,
): ApiFailResponse => {
  if (typeof detail === 'string') {
    return { ok: false, error: detail };
  }
  if ('message' in detail && typeof detail.message === 'string') {
    const { message, ...meta } = detail;
    const response: ApiFailResponse = { ok: false, error: message };
    if (Object.keys(meta).length > 0) {
      response.meta = meta;
    }
    return response;
  }
  return { ok: false, error: 'Request failed', meta: detail };
};

export const sendSuccess = <T>(res: Response, data: T, status = 200): void => {
  res.status(status).json(successResponse(data));
};

export const sendError = (
  res: Response,
  status: number,
  detail: string | Record<string, unknown>,
): void => {
  res.status(status).json(normalizeError(detail));
};

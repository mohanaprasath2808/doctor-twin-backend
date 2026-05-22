import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ObjectSchema, ValidationError } from 'joi';
import { AppError } from '../utils/AppError';

export type ValidationSource = 'body' | 'query' | 'params' | 'headers';

const formatJoiErrors = (error: ValidationError): Record<string, string> => {
  return error.details.reduce<Record<string, string>>((acc, detail) => {
    const key = detail.path.join('.') || 'value';
    acc[key] = detail.message.replace(/"/g, "'");
    return acc;
  }, {});
};

export const validate = (
  schema: ObjectSchema,
  source: ValidationSource = 'body',
): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      return next(
        new AppError('Validation failed', 400, formatJoiErrors(error)),
      );
    }

    req[source] = value;
    next();
  };
};

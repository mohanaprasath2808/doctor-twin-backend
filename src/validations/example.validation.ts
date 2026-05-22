import Joi from 'joi';

export const createGreetingSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'name is required',
    'any.required': 'name is required',
  }),
  message: Joi.string().trim().max(500).optional().default('Hello'),
});

export type CreateGreetingInput = {
  name: string;
  message: string;
};

import Joi from 'joi';

export const createUserSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(6).max(128).required(),
});

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
};

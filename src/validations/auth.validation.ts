import Joi from 'joi';
import { LOGIN_ROLES, OTP_TYPES, USER_ROLES } from '../constants/auth.constants';

const email = Joi.string().email().lowercase().trim();
const phone = Joi.string().min(10).max(20).trim();

export const loginSchema = Joi.object({
  login_role: Joi.string()
    .valid(...LOGIN_ROLES)
    .required(),
  email: email.when('login_role', {
    is: Joi.valid('doctor', 'staff'),
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  phone: phone.when('login_role', {
    is: 'patient',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  auth_method: Joi.string().valid('password', 'sso', 'otp').default('password'),
  password: Joi.string().when('login_role', {
    is: Joi.valid('doctor', 'staff'),
    then: Joi.when('auth_method', {
      is: 'password',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    otherwise: Joi.optional(),
  }),
  mfa_code: Joi.string().optional(),
  role: Joi.string()
    .valid(...USER_ROLES)
    .optional(),
  location_code: Joi.string().optional(),
  device_id: Joi.string().optional(),
}).options({ stripUnknown: true });

export const refreshSchema = Joi.object({
  refresh_token: Joi.string().required(),
}).options({ stripUnknown: true });

export const resendOtpSchema = Joi.object({
  email: email.optional(),
  phone: phone.optional(),
  otp_type: Joi.string()
    .valid(...OTP_TYPES)
    .required(),
})
  .xor('email', 'phone')
  .options({ stripUnknown: true });

export const signupSchema = Joi.object({
  first_name: Joi.string().min(1).max(100).required(),
  last_name: Joi.string().min(1).max(100).required(),
  email: email.required(),
  phone: phone.required(),
  date_of_birth: Joi.date().iso().required(),
  user_agreement_consent: Joi.boolean().valid(true).required(),
  role: Joi.string().valid('patient').required(),
}).options({ stripUnknown: true });

export const registerUserSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  email: email.required(),
  phone: phone.required(),
  password: Joi.string().min(8).required(),
  date_of_birth: Joi.date().iso().required(),
  role: Joi.string()
    .valid(...USER_ROLES)
    .required(),
}).options({ stripUnknown: true });

export const verifyOtpSchema = Joi.object({
  otp_type: Joi.string()
    .valid(...OTP_TYPES)
    .required(),
  role: Joi.string()
    .valid(...LOGIN_ROLES)
    .required(),
  code: Joi.string().min(4).max(8).required(),
  email: email.when('role', {
    is: Joi.valid('doctor', 'staff'),
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  phone: phone.when('role', {
    is: 'patient',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
}).options({ stripUnknown: true });

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  role: Joi.string().valid('doctor', 'staff').required(),
  email: email.required(),
  new_password: Joi.string().min(12).required(),
}).options({ stripUnknown: true });

export const createUserSchema = Joi.object({
  email: email.required(),
  password: Joi.string().min(12).required(),
  role: Joi.string()
    .valid(...USER_ROLES)
    .required(),
  location_code: Joi.string().optional(),
}).options({ stripUnknown: true });

export const setPinSchema = Joi.object({
  user_id: Joi.string().required(),
  pin: Joi.string()
    .pattern(/^\d+$/)
    .min(4)
    .max(8)
    .required()
    .messages({ 'string.pattern.base': 'pin must be numeric' }),
}).options({ stripUnknown: true });

export const verifyPinSchema = Joi.object({
  user_id: Joi.string().required(),
  pin: Joi.string()
    .pattern(/^\d+$/)
    .min(4)
    .max(8)
    .required()
    .messages({ 'string.pattern.base': 'pin must be numeric' }),
}).options({ stripUnknown: true });

export const generateBackupCodeSchema = Joi.object({
  email: email.required(),
}).options({ stripUnknown: true });

export const verifyBackupCodeSchema = Joi.object({
  email: email.required(),
  backupcode: Joi.string()
    .length(4)
    .pattern(/^\d+$/)
    .required()
    .messages({ 'string.pattern.base': 'backupcode must be 4 digits' }),
}).options({ stripUnknown: true });

export const updateUserFlagsSchema = Joi.object({
  faceIdSet: Joi.boolean().optional(),
  failedAttempts: Joi.number().integer().min(0).optional(),
})
  .or('faceIdSet', 'failedAttempts')
  .options({ stripUnknown: true });

export const changePasswordSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(12).required(),
}).options({ stripUnknown: true });

export const mfaVerifySchema = Joi.object({
  code: Joi.string().min(6).max(8).required(),
}).options({ stripUnknown: true });

export const apiKeyCreateSchema = Joi.object({
  name: Joi.string().min(1).max(128).required(),
  scopes: Joi.array().items(Joi.string()).default([]),
  expires_days: Joi.number().integer().min(1).max(365).optional(),
}).options({ stripUnknown: true });

export const breakGlassSchema = Joi.object({
  reason: Joi.string().min(10).max(1000).required(),
}).options({ stripUnknown: true });

export const patientOtpRequestSchema = Joi.object({
  phone: phone.required(),
}).options({ stripUnknown: true });

export const patientOtpVerifySchema = Joi.object({
  phone: phone.required(),
  otp: Joi.string().length(6).required(),
}).options({ stripUnknown: true });

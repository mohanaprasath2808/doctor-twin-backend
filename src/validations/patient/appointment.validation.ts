import Joi from 'joi';
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STEPS,
} from '../../constants/patient/appointment.constants';

export const listAppointmentsSchema = Joi.object({
  status: Joi.string()
    .valid(...APPOINTMENT_STATUSES)
    .optional(),
}).options({ stripUnknown: true });

const timeSlotPattern = /^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/i;

const appointmentId = Joi.string().uuid().required();

export const saveAppointmentStepSchema = Joi.object({
  step: Joi.number()
    .valid(...APPOINTMENT_STEPS)
    .required(),
  appointment_id: appointmentId.when('step', {
    is: Joi.valid(2, 3),
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  reason: Joi.string().min(1).max(2000).when('step', {
    is: 1,
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  insurance_name: Joi.string().max(200).when('step', {
    is: 1,
    then: Joi.optional().allow(null, ''),
    otherwise: Joi.forbidden(),
  }),
  provider_name: Joi.string().max(200).when('step', {
    is: 1,
    then: Joi.optional().allow(null, ''),
    otherwise: Joi.forbidden(),
  }),
  category: Joi.string().min(1).max(200).when('step', {
    is: 2,
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  appointment_type: Joi.string().min(1).max(200).when('step', {
    is: 2,
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  appointment_date: Joi.date().iso().when('step', {
    is: 3,
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  time_slot: Joi.string()
    .pattern(timeSlotPattern)
    .when('step', {
      is: 3,
      then: Joi.required().messages({
        'string.pattern.base':
          'time_slot must be in format like 10:15 AM or 3:00 PM',
      }),
      otherwise: Joi.forbidden(),
    }),
}).options({ stripUnknown: true });

import { Router } from 'express';
import * as appointmentController from '../../controllers/patient/appointments/appointment.controller';
import { currentUser } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  listAppointmentsSchema,
  saveAppointmentStepSchema,
} from '../../validations/patient/appointment.validation';

const router = Router();

router.post(
  '/',
  currentUser,
  validate(saveAppointmentStepSchema),
  appointmentController.createAppointment,
);

router.post(
  '/list',
  currentUser,
  validate(listAppointmentsSchema),
  appointmentController.listAppointments,
);

router.get(
  '/:appointment_id',
  currentUser,
  appointmentController.getAppointment,
);

router.post(
  '/:appointment_id/cancel',
  currentUser,
  appointmentController.cancelAppointment,
);

export default router;

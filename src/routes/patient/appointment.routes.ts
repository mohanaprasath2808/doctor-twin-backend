import { Router } from 'express';
import {
  cancelAppointment,
  createAppointment,
} from '../../controllers/patient/appointments';
import { currentUser } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { saveAppointmentStepSchema } from '../../validations/patient/appointment.validation';

const router = Router();

router.post(
  '/',
  currentUser,
  validate(saveAppointmentStepSchema),
  createAppointment,
);

router.post(
  '/:appointment_id/cancel',
  currentUser,
  cancelAppointment,
);

export default router;

import { Router } from 'express';
import appointmentRoutes from './patient/appointment.routes';
import authRoutes from './auth.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/appointments', appointmentRoutes);

export default router;

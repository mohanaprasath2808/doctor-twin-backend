import { Router } from 'express';
import healthRoutes from './health.routes';
import exampleRoutes from './example.routes';
import userRoutes from './user.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/examples', exampleRoutes);
router.use('/users', userRoutes);

export default router;

import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware';
import { createGreetingSchema } from '../validations/example.validation';
import { createGreeting } from '../controllers/example.controller';

const router = Router();

router.post('/greeting', validate(createGreetingSchema), createGreeting);

export default router;

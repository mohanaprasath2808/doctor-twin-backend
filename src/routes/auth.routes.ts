import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { currentUser, requireRole } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  apiKeyCreateSchema,
  breakGlassSchema,
  changePasswordSchema,
  createAppointmentSchema,
  createUserSchema,
  generateBackupCodeSchema,
  loginSchema,
  mfaVerifySchema,
  patientOtpRequestSchema,
  patientOtpVerifySchema,
  refreshSchema,
  registerUserSchema,
  resendOtpSchema,
  resetPasswordSchema,
  setPinSchema,
  signupSchema,
  updateUserFlagsSchema,
  verifyBackupCodeSchema,
  verifyOtpSchema,
  verifyPinSchema,
} from '../validations/auth.validation';

const router = Router();

const API_KEY_ROLES = new Set(['physician', 'admin', 'workflow_coordinator']);

const BREAK_GLASS_ROLES = new Set([
  'physician',
  'covering_md',
  'resident',
  'physician_assistant',
  'admin',
]);

router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/resend-otp', validate(resendOtpSchema), authController.resendOtp);
router.post('/signup', validate(signupSchema), authController.signup);
router.post(
  '/create-user',
  validate(registerUserSchema),
  authController.createUserPublic,
);
router.post('/verify-otp', validate(verifyOtpSchema), authController.verifyOtp);
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  authController.resetPassword,
);
router.post(
  '/backup-code/generate',
  validate(generateBackupCodeSchema),
  authController.generateBackupCode,
);
router.post(
  '/backup-code/verify',
  validate(verifyBackupCodeSchema),
  authController.verifyBackupCode,
);
router.post(
  '/patient/request-otp',
  validate(patientOtpRequestSchema),
  authController.patientRequestOtp,
);
router.post(
  '/patient/verify-otp',
  validate(patientOtpVerifySchema),
  authController.patientVerifyOtp,
);

router.get('/me', currentUser, authController.getMe);
router.post(
  '/set-pin',
  currentUser,
  validate(setPinSchema),
  authController.setPin,
);
router.post(
  '/verify-pin',
  currentUser,
  validate(verifyPinSchema),
  authController.verifyPin,
);
router.patch(
  '/users/:user_id',
  currentUser,
  validate(updateUserFlagsSchema),
  authController.updateUserFlags,
);
router.post(
  '/change-password',
  currentUser,
  validate(changePasswordSchema),
  authController.changePassword,
);
router.post('/mfa/enable', currentUser, authController.mfaEnable);
router.post(
  '/mfa/verify-setup',
  currentUser,
  validate(mfaVerifySchema),
  authController.mfaVerifySetup,
);
router.post(
  '/mfa/disable',
  currentUser,
  validate(mfaVerifySchema),
  authController.mfaDisable,
);

router.post(
  '/logout',
  requireRole(authController.ALL_STAFF_ROLES),
  authController.logout,
);
router.post(
  '/users',
  requireRole(new Set(['admin'])),
  validate(createUserSchema),
  authController.createUserAdmin,
);
router.post(
  '/users/:user_id/deactivate',
  requireRole(new Set(['admin'])),
  authController.deactivateUser,
);
router.get('/api-keys', requireRole(API_KEY_ROLES), authController.listApiKeys);
router.post(
  '/api-keys',
  requireRole(API_KEY_ROLES),
  validate(apiKeyCreateSchema),
  authController.createApiKey,
);
router.delete(
  '/api-keys/:key_id',
  requireRole(API_KEY_ROLES),
  authController.revokeApiKey,
);
router.post(
  '/break-glass',
  requireRole(BREAK_GLASS_ROLES),
  validate(breakGlassSchema),
  authController.breakGlass,
);
router.post(
  '/appointments',
  currentUser,
  validate(createAppointmentSchema),
  authController.createAppointment,
);

export default router;

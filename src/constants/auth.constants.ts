export const DOCTOR_USER_ROLES = new Set(['physician', 'covering_md']);
export const STAFF_USER_ROLES = new Set([
  'office_manager',
  'nurse',
  'biller',
  'receptionist',
]);

export const ALL_STAFF_ROLES = new Set([
  'physician',
  'covering_md',
  'resident',
  'physician_assistant',
  'medical_assistant',
  'nurse',
  'office_manager',
  'biller',
  'receptionist',
  'scheduling_assistant',
  'workflow_coordinator',
  'admin',
]);

export const USER_ROLES = [
  'physician',
  'covering_md',
  'resident',
  'physician_assistant',
  'medical_assistant',
  'nurse',
  'office_manager',
  'biller',
  'receptionist',
  'scheduling_assistant',
  'workflow_coordinator',
  'admin',
  'patient',
] as const;

export const OTP_TYPES = [
  'login',
  'signup',
  'forgot_password',
  'faceId',
  'pinOtp',
  'backupcode',
] as const;

export const LOGIN_ROLES = ['doctor', 'staff', 'patient'] as const;

export const PIN_MAX_ATTEMPTS = 5;

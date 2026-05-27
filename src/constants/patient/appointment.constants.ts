export const APPOINTMENT_STATUSES = [
  'Pending',
  'Completed',
  'Cancelled',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STEPS = [1, 2, 3] as const;

export type AppointmentStep = (typeof APPOINTMENT_STEPS)[number];

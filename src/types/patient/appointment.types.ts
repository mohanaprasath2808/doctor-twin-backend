import { AppointmentStatus } from '../../constants/patient/appointment.constants';

export type AppointmentResponse = {
  appointment_id: string;
  patient_id: string;
  status: AppointmentStatus;
  step_completed: number;
  reason: string | null;
  insurance_name: string | null;
  provider_name: string | null;
  category: string | null;
  appointment_type: string | null;
  appointment_date: string | null;
  time_slot: string | null;
  created_at: Date;
  updated_at: Date;
};

export type AppointmentScheduledResponse = AppointmentResponse & {
  title: string;
  message: string;
};

export type SaveAppointmentStepPayload =
  | {
      step: 1;
      reason: string;
      insurance_name?: string | null;
      provider_name?: string | null;
    }
  | {
      step: 2;
      appointment_id: string;
      category: string;
      appointment_type: string;
    }
  | {
      step: 3;
      appointment_id: string;
      appointment_date: string;
      time_slot: string;
    };

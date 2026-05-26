import { Appointments } from '@prisma/client';
import { AppointmentStatus } from '../../constants/patient/appointment.constants';
import { DOCTOR_USER_ROLES } from '../../constants/auth.constants';
import { AppointmentFlowError } from '../../errors/patient/AppointmentFlowError';
import {
  AppointmentResponse,
  AppointmentScheduledResponse,
  SaveAppointmentStepPayload,
} from '../../types/patient/appointment.types';
import { UserMetadata } from '../../types/identity.types';
import { DbClient } from '../../types/prisma.types';
import {
  formatAppointmentScheduledMessage,
  getPatientDisplayName,
} from '../../utils/patient/appointmentMessage.util';
import { AppointmentDb } from './appointment.db';

const PREVIOUS_STEPS_ERROR = 'Please complete previous steps';

const isFilled = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.trim().length > 0;

const getStepCompleted = (appointment: Appointments): number => {
  if (!isFilled(appointment.reason)) return 0;
  if (!isFilled(appointment.category) || !isFilled(appointment.appointmentType)) {
    return 1;
  }
  if (!appointment.appointmentDate || !isFilled(appointment.timeSlot)) {
    return 2;
  }
  return 3;
};

const deriveStatus = (appointment: Appointments): AppointmentStatus => {
  if (appointment.status === 'Cancelled') return 'Cancelled';
  if (getStepCompleted(appointment) === 3) return 'Completed';
  return 'Pending';
};

const toDateOnlyString = (date: Date): string =>
  date.toISOString().slice(0, 10);

const toAppointmentResponse = (
  appointment: Appointments,
): AppointmentResponse => ({
  appointment_id: appointment.appointmentId,
  patient_id: appointment.patientId,
  status: deriveStatus(appointment),
  step_completed: getStepCompleted(appointment),
  reason: appointment.reason,
  insurance_name: appointment.insuranceName,
  provider_name: appointment.providerName,
  category: appointment.category,
  appointment_type: appointment.appointmentType,
  appointment_date: appointment.appointmentDate
    ? toDateOnlyString(appointment.appointmentDate)
    : null,
  time_slot: appointment.timeSlot,
  created_at: appointment.createdAt,
  updated_at: appointment.updatedAt,
});

export class AppointmentService {
  private readonly data: AppointmentDb;

  constructor(db: DbClient) {
    this.data = new AppointmentDb(db);
  }

  private async assertActivePatient(patientId: string): Promise<void> {
    const user = await this.data.findUserById(patientId);
    if (!user) {
      throw new Error('User not found');
    }
    if (user.role !== 'patient') {
      throw new Error('Only patients can book appointments');
    }
    if (!user.isActive) {
      throw new Error('Account is not active');
    }
  }

  private assertEditable(appointment: Appointments): void {
    if (appointment.status === 'Cancelled') {
      throw new AppointmentFlowError('Appointment has been cancelled');
    }
    if (deriveStatus(appointment) === 'Completed') {
      throw new AppointmentFlowError('Appointment is already scheduled');
    }
  }

  private assertStep1Complete(appointment: Appointments): void {
    if (!isFilled(appointment.reason)) {
      throw new AppointmentFlowError(PREVIOUS_STEPS_ERROR);
    }
  }

  private assertStep2Complete(appointment: Appointments): void {
    this.assertStep1Complete(appointment);
    if (!isFilled(appointment.category) || !isFilled(appointment.appointmentType)) {
      throw new AppointmentFlowError(PREVIOUS_STEPS_ERROR);
    }
  }

  private async getPatientAppointment(
    appointmentId: string,
    patientId: string,
  ): Promise<Appointments> {
    const appointment = await this.data.findAppointmentById(appointmentId);
    if (!appointment || appointment.patientId !== patientId) {
      throw new Error('Appointment not found');
    }
    return appointment;
  }

  async saveAppointmentStep(
    patientId: string,
    payload: SaveAppointmentStepPayload,
  ): Promise<AppointmentResponse | AppointmentScheduledResponse> {
    await this.assertActivePatient(patientId);

    if (payload.step === 1) {
      const appointment = await this.data.createAppointment({
        patient: { connect: { userId: patientId } },
        reason: payload.reason.trim(),
        insuranceName: payload.insurance_name?.trim() || null,
        providerName: payload.provider_name?.trim() || null,
        status: 'Pending',
      });
      return toAppointmentResponse(appointment);
    }

    const appointment = await this.getPatientAppointment(
      payload.appointment_id,
      patientId,
    );
    this.assertEditable(appointment);

    if (payload.step === 2) {
      this.assertStep1Complete(appointment);
      const updated = await this.data.updateAppointment(
        payload.appointment_id,
        {
          category: payload.category.trim(),
          appointmentType: payload.appointment_type.trim(),
          status: 'Pending',
        },
      );
      return toAppointmentResponse(updated);
    }

    this.assertStep2Complete(appointment);
    const appointmentDate = new Date(`${payload.appointment_date}T00:00:00.000Z`);
    if (Number.isNaN(appointmentDate.getTime())) {
      throw new Error('Invalid appointment date');
    }

    const updated = await this.data.updateAppointment(payload.appointment_id, {
      appointmentDate,
      timeSlot: payload.time_slot.trim(),
      status: 'Completed',
    });

    const user = await this.data.findUserById(patientId);
    const metadata = (user?.metadata as UserMetadata | null) ?? undefined;
    const displayName = getPatientDisplayName(metadata);
    const { title, message } = formatAppointmentScheduledMessage(
      displayName,
      appointmentDate,
      payload.time_slot.trim(),
    );

    return {
      ...toAppointmentResponse(updated),
      title,
      message,
    };
  }

  async cancelAppointment(
    appointmentId: string,
    actorId: string,
    actorRole: string,
  ): Promise<AppointmentResponse> {
    const appointment = await this.data.findAppointmentById(appointmentId);
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    const isPatientOwner =
      actorRole === 'patient' && appointment.patientId === actorId;
    const isDoctor = DOCTOR_USER_ROLES.has(actorRole);

    if (!isPatientOwner && !isDoctor) {
      throw new Error('Not allowed to cancel this appointment');
    }

    if (appointment.status === 'Cancelled') {
      throw new AppointmentFlowError('Appointment is already cancelled');
    }

    const updated = await this.data.updateAppointment(appointmentId, {
      status: 'Cancelled',
    });

    return toAppointmentResponse(updated);
  }
}

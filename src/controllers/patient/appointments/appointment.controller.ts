import { Request, Response } from 'express';
import prisma from '../../../client';
import { AppointmentFlowError } from '../../../errors/patient/AppointmentFlowError';
import { AuthenticationError } from '../../../errors/AuthenticationError';
import { AppointmentService } from '../../../services/patient/appointment.service';
import { SaveAppointmentStepPayload } from '../../../types/patient/appointment.types';
import { sendError, sendSuccess } from '../../../utils/apiEnvelope';
import { catchAsync } from '../../../utils/catchAsync';

const handleAppointmentError = (res: Response, err: unknown): void => {
  if (err instanceof AuthenticationError) {
    const detail =
      Object.keys(err.extraData).length > 0
        ? { message: err.message, ...err.extraData }
        : err.message;
    sendError(res, 401, detail);
    return;
  }
  if (err instanceof AppointmentFlowError) {
    sendError(res, 400, err.message);
    return;
  }
  if (err instanceof Error) {
    const status = err.message === 'Not allowed to cancel this appointment' ? 403 : 400;
    sendError(res, status, err.message);
    return;
  }
  sendError(res, 500, 'Internal server error');
};

const withTx = async <T>(
  fn: (service: AppointmentService) => Promise<T>,
): Promise<T> => {
  return prisma.$transaction(async (tx) => {
    const service = new AppointmentService(tx);
    return fn(service);
  });
};

const buildStepPayload = (body: Request['body']): SaveAppointmentStepPayload => {
  if (body.step === 1) {
    return {
      step: 1,
      reason: body.reason,
      insurance_name: body.insurance_name,
      provider_name: body.provider_name,
    };
  }
  if (body.step === 2) {
    return {
      step: 2,
      appointment_id: body.appointment_id,
      category: body.category,
      appointment_type: body.appointment_type,
    };
  }
  return {
    step: 3,
    appointment_id: body.appointment_id,
    appointment_date:
      body.appointment_date instanceof Date
        ? body.appointment_date.toISOString().slice(0, 10)
        : String(body.appointment_date),
    time_slot: body.time_slot,
  };
};

export const createAppointment = catchAsync(
  async (req: Request, res: Response) => {
    if (!req.auth) {
      sendError(res, 401, 'Not authenticated');
      return;
    }
    if (req.auth.role !== 'patient') {
      sendError(res, 403, 'Only patients can book appointments');
      return;
    }
    try {
      const payload = buildStepPayload(req.body);
      const result = await withTx((service) =>
        service.saveAppointmentStep(req.auth!.sub, payload),
      );
      const status = payload.step === 1 ? 201 : 200;
      sendSuccess(res, result, status);
    } catch (err) {
      handleAppointmentError(res, err);
    }
  },
);

export const cancelAppointment = catchAsync(
  async (req: Request, res: Response) => {
    if (!req.auth) {
      sendError(res, 401, 'Not authenticated');
      return;
    }
    try {
      const result = await withTx((service) =>
        service.cancelAppointment(
          req.params.appointment_id as string,
          req.auth!.sub,
          req.auth!.role,
        ),
      );
      sendSuccess(res, result);
    } catch (err) {
      handleAppointmentError(res, err);
    }
  },
);

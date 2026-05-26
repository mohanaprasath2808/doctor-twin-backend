import { Request, Response } from 'express';
import prisma from '../client';
import { ALL_STAFF_ROLES } from '../constants/auth.constants';
import { AuthenticationError } from '../errors/AuthenticationError';
import { IdentityService } from '../services/identity.service';
import { sendError, sendSuccess } from '../utils/apiEnvelope';
import { catchAsync } from '../utils/catchAsync';

const getService = (): IdentityService => new IdentityService(prisma);

const handleAuthError = (res: Response, err: unknown): void => {
  if (err instanceof AuthenticationError) {
    const detail =
      Object.keys(err.extraData).length > 0
        ? { message: err.message, ...err.extraData }
        : err.message;
    sendError(res, 401, detail);
    return;
  }
  if (err instanceof Error) {
    sendError(res, 400, err.message);
    return;
  }
  sendError(res, 500, 'Internal server error');
};

const withTx = async <T>(
  fn: (service: IdentityService) => Promise<T>,
): Promise<T> => {
  return prisma.$transaction(async (tx) => {
    const service = new IdentityService(tx);
    return fn(service);
  });
};

export const login = catchAsync(async (req: Request, res: Response) => {
  try {
    const result = await withTx((service) =>
      service.login(req.body, req.ip ?? null),
    );
    sendSuccess(res, result);
  } catch (err) {
    handleAuthError(res, err);
  }
});

export const refresh = catchAsync(async (req: Request, res: Response) => {
  try {
    const result = await withTx((service) =>
      service.refresh(req.body.refresh_token),
    );
    sendSuccess(res, result);
  } catch (err) {
    handleAuthError(res, err);
  }
});

export const resendOtp = catchAsync(async (req: Request, res: Response) => {
  const result = await withTx((service) => service.resendOtp(req.body));
  sendSuccess(res, result);
});

export const signup = catchAsync(async (req: Request, res: Response) => {
  try {
    const body = {
      ...req.body,
      date_of_birth:
        req.body.date_of_birth instanceof Date
          ? req.body.date_of_birth.toISOString().slice(0, 10)
          : String(req.body.date_of_birth),
    };
    const result = await withTx((service) => service.signupPatient(body));
    sendSuccess(res, result);
  } catch (err) {
    handleAuthError(res, err);
  }
});

export const createUserPublic = catchAsync(
  async (req: Request, res: Response) => {
    try {
      const body = {
        ...req.body,
        date_of_birth:
          req.body.date_of_birth instanceof Date
            ? req.body.date_of_birth.toISOString().slice(0, 10)
            : String(req.body.date_of_birth),
      };
      const result = await withTx((service) => service.registerUser(body));
      sendSuccess(res, result);
    } catch (err) {
      handleAuthError(res, err);
    }
  },
);

export const verifyOtp = catchAsync(async (req: Request, res: Response) => {
  try {
    const result = await withTx((service) =>
      service.verifyOtp(req.body, req.ip ?? null),
    );
    sendSuccess(res, result);
  } catch (err) {
    handleAuthError(res, err);
  }
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  try {
    const result = await withTx((service) => service.resetPassword(req.body));
    sendSuccess(res, result);
  } catch (err) {
    handleAuthError(res, err);
  }
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  await withTx((service) => service.revokeSession(req.auth?.session_id ?? ''));
  sendSuccess(res, { logged_out: true });
});

export const getMe = catchAsync(async (req: Request, res: Response) => {
  const service = getService();
  const user = await service.getCurrentUser(req.auth!.sub);
  sendSuccess(res, user);
});

export const setPin = catchAsync(async (req: Request, res: Response) => {
  if (req.auth!.sub !== req.body.user_id && req.auth!.role !== 'admin') {
    sendError(res, 403, 'Not allowed');
    return;
  }
  const result = await withTx((service) => service.setPin(req.body));
  sendSuccess(res, result);
});

export const verifyPin = catchAsync(async (req: Request, res: Response) => {
  try {
    const result = await withTx((service) =>
      service.verifyPin(req.body.user_id, req.body.pin),
    );
    sendSuccess(res, result);
  } catch (err) {
    handleAuthError(res, err);
  }
});

export const generateBackupCode = catchAsync(
  async (req: Request, res: Response) => {
    try {
      const result = await withTx((service) =>
        service.generateBackupCode(req.body),
      );
      sendSuccess(res, result);
    } catch (err) {
      handleAuthError(res, err);
    }
  },
);

export const verifyBackupCode = catchAsync(
  async (req: Request, res: Response) => {
    try {
      const result = await withTx((service) =>
        service.verifyBackupCode(req.body.email, req.body.backupcode),
      );
      sendSuccess(res, result);
    } catch (err) {
      handleAuthError(res, err);
    }
  },
);

export const updateUserFlags = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.params.user_id as string;
    if (req.auth!.sub !== userId && req.auth!.role !== 'admin') {
      sendError(res, 403, 'Not allowed');
      return;
    }
    try {
      const result = await withTx((service) =>
        service.updateUserFlags(userId, req.body),
      );
      sendSuccess(res, result);
    } catch (err) {
      handleAuthError(res, err);
    }
  },
);

export const createUserAdmin = catchAsync(
  async (req: Request, res: Response) => {
    try {
      const result = await withTx((service) => service.createUser(req.body));
      sendSuccess(res, result);
    } catch (err) {
      handleAuthError(res, err);
    }
  },
);

export const deactivateUser = catchAsync(
  async (req: Request, res: Response) => {
    try {
      await withTx((service) =>
        service.deactivateUser(req.params.user_id as string),
      );
      sendSuccess(res, { deactivated: true });
    } catch (err) {
      handleAuthError(res, err);
    }
  },
);

export const changePassword = catchAsync(
  async (req: Request, res: Response) => {
    try {
      await withTx((service) =>
        service.changePassword(
          req.auth!.sub,
          req.body.current_password,
          req.body.new_password,
        ),
      );
      sendSuccess(res, {
        password_changed: true,
        sessions_revoked: true,
      });
    } catch (err) {
      handleAuthError(res, err);
    }
  },
);

export const mfaEnable = catchAsync(async (req: Request, res: Response) => {
  try {
    const result = await withTx((service) => service.enableMfa(req.auth!.sub));
    sendSuccess(res, result);
  } catch (err) {
    handleAuthError(res, err);
  }
});

export const mfaVerifySetup = catchAsync(
  async (req: Request, res: Response) => {
    try {
      const backupCodes = await withTx((service) =>
        service.verifyMfaSetup(req.auth!.sub, req.body.code),
      );
      sendSuccess(res, { mfa_enabled: true, backup_codes: backupCodes });
    } catch (err) {
      handleAuthError(res, err);
    }
  },
);

export const mfaDisable = catchAsync(async (req: Request, res: Response) => {
  try {
    await withTx((service) => service.disableMfa(req.auth!.sub, req.body.code));
    sendSuccess(res, { mfa_enabled: false });
  } catch (err) {
    handleAuthError(res, err);
  }
});

export const listApiKeys = catchAsync(async (req: Request, res: Response) => {
  const service = getService();
  const keys = await service.listApiKeys(req.auth!.sub);
  sendSuccess(res, keys);
});

export const createApiKey = catchAsync(async (req: Request, res: Response) => {
  const result = await withTx((service) =>
    service.createApiKey({
      userId: req.auth!.sub,
      name: req.body.name,
      scopes: req.body.scopes ?? [],
      expiresDays: req.body.expires_days ?? null,
    }),
  );
  sendSuccess(res, result);
});

export const revokeApiKey = catchAsync(async (req: Request, res: Response) => {
  const service = getService();
  const revoked = await service.revokeApiKey(
    req.params.key_id as string,
    req.auth!.sub,
  );
  if (!revoked) {
    sendError(res, 404, 'API key not found');
    return;
  }
  sendSuccess(res, { revoked: true });
});

export const breakGlass = catchAsync(async (req: Request, res: Response) => {
  const result = await withTx((service) =>
    service.createBreakGlassSession({
      userId: req.auth!.sub,
      reason: req.body.reason,
      ipAddress: req.ip ?? null,
    }),
  );
  sendSuccess(res, result);
});

export const patientRequestOtp = catchAsync(
  async (req: Request, res: Response) => {
    const result = await withTx((service) =>
      service.requestPatientOtp(req.body.phone),
    );
    sendSuccess(res, result);
  },
);

export const patientVerifyOtp = catchAsync(
  async (req: Request, res: Response) => {
    try {
      const result = await withTx((service) =>
        service.verifyPatientOtp(req.body.phone, req.body.otp),
      );
      sendSuccess(res, result);
    } catch (err) {
      handleAuthError(res, err);
    }
  },
);

//PATIENT APPOINTMENT BOOKING
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
      const result = await withTx((service) =>
        service.bookAppointment(
          req.auth!.sub,
          req.body.reason,
          req.body.insurance_name,
          req.body.provider_name,
        ),
      );
      sendSuccess(res, result);
    } catch (err) {
      handleAuthError(res, err);
    }
  },
);

export { ALL_STAFF_ROLES };

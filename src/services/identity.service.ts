import { randomBytes, randomInt } from 'crypto';
import { Prisma, User } from '@prisma/client';
import { IdentityDb } from './identity.db';
import { DbClient } from '../types/prisma.types';
import { authenticator } from 'otplib';
import { env } from '../config/env';
import {
  DOCTOR_USER_ROLES,
  PIN_MAX_ATTEMPTS,
  STAFF_USER_ROLES,
} from '../constants/auth.constants';
import { AuthenticationError } from '../errors/AuthenticationError';
import {
  BackupCodeEntry,
  ResetPasswordPayload,
  TokenResponse,
  UserMetadata,
  UserResponse,
} from '../types/identity.types';
import {
  generateApiKey,
  generatePatientToken,
  hashPassword,
  hashPin,
  sha256,
  verifyPassword,
  verifyPin,
} from '../utils/hash.util';
import {
  decodeToken,
  issueAccessToken,
  issueRefreshToken,
  issueResetPasswordToken,
  TokenError,
} from '../utils/tokens.util';
import { logger } from '../utils/logger';

const parseJsonStringArray = (value: Prisma.JsonValue | null): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};

export class IdentityService {
  private readonly data: IdentityDb;

  constructor(db: DbClient) {
    this.data = new IdentityDb(db);
  }

  async login(
    request: {
      login_role: 'doctor' | 'staff' | 'patient';
      email?: string;
      phone?: string;
      auth_method?: string;
      password?: string;
      mfa_code?: string;
      role?: string;
      location_code?: string;
      device_id?: string;
    },
    ipAddress?: string | null,
  ): Promise<Record<string, unknown>> {
    if (request.login_role === 'doctor') {
      return this.loginAsDoctor(request);
    }
    if (request.login_role === 'staff') {
      return this.loginAsStaff(request, ipAddress);
    }
    if (request.login_role === 'patient') {
      return this.loginAsPatient(request);
    }
    throw new AuthenticationError('Unsupported login role');
  }

  private async loginAsDoctor(request: {
    email?: string;
    password?: string;
  }): Promise<Record<string, unknown>> {
    const user = await this.validateStaffCredentials({
      email: request.email ?? '',
      password: request.password ?? '',
      allowedRoles: DOCTOR_USER_ROLES,
    });
    await this.data.resetUserFailedAttempts(user.userId);
    const otp = this.generate4DigitOtp();
    const ttl = env.patientOtpTtlMinutes;
    const expiresAt = new Date(Date.now() + ttl * 60_000);
    await this.data.createLoginOtp({
      recipient: user.email,
      recipientType: 'email',
      otpHash: sha256(otp),
      otpType: 'login',
      expiresAt,
    });
    return {
      message: 'Login OTP sent to your email',
      otp_type: 'login',
      expires_in_minutes: ttl,
      otp,
    };
  }

  private async loginAsStaff(
    request: {
      email?: string;
      password?: string;
      mfa_code?: string;
      auth_method?: string;
      role?: string;
      location_code?: string;
      device_id?: string;
    },
    ipAddress?: string | null,
  ): Promise<Record<string, unknown>> {
    const user = await this.validateStaffCredentials({
      email: request.email ?? '',
      password: request.password ?? '',
      allowedRoles: STAFF_USER_ROLES,
      mfaCode: request.mfa_code,
    });
    await this.data.resetUserFailedAttempts(user.userId);
    const expiresAt = new Date(
      Date.now() + env.refreshTokenTtlDays * 86_400_000,
    );
    const authSession = await this.data.createAuthSession({
      userId: user.userId,
      authMethod: request.auth_method ?? 'password',
      role: request.role ?? user.role,
      locationCode: request.location_code ?? null,
      deviceId: request.device_id ?? null,
      ipAddress: ipAddress ?? null,
      expiresAt,
    });
    await this.data.updateUserById(user.userId, { lastLoginAt: new Date() });
    logger.info('Auth success', {
      sessionId: authSession.sessionId,
      userId: user.userId,
      role: authSession.role,
    });
    const tokens = await this.issueTokens(user, authSession);
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: this.toUserResponse(user),
    };
  }

  private async loginAsPatient(request: {
    phone?: string;
  }): Promise<Record<string, unknown>> {
    if (!request.phone) {
      throw new AuthenticationError('phone is required for patient login');
    }
    const patients = await this.data.listUsersByRole('patient');
    const exists = patients.some(
      (p) => (p.metadata as UserMetadata | null)?.phone === request.phone,
    );
    if (!exists) {
      throw new Error('Patient not found. Please sign up first.');
    }
    const otp = this.generate4DigitOtp();
    const ttl = env.patientOtpTtlMinutes;
    const expiresAt = new Date(Date.now() + ttl * 60_000);
    await this.data.createLoginOtp({
      recipient: request.phone,
      recipientType: 'phone',
      otpHash: sha256(otp),
      otpType: 'login',
      expiresAt,
    });
    return {
      message: 'Login OTP sent to your phone',
      otp_type: 'login',
      expires_in_minutes: ttl,
      otp,
    };
  }

  async resendOtp(request: {
    email?: string;
    phone?: string;
    otp_type: string;
  }): Promise<Record<string, unknown>> {
    const otp = this.generate4DigitOtp();
    const ttl = env.patientOtpTtlMinutes;
    const expiresAt = new Date(Date.now() + ttl * 60_000);
    const recipient = request.email
      ? request.email.toLowerCase()
      : (request.phone ?? '');
    const recipientType = request.email ? 'email' : 'phone';
    await this.data.createLoginOtp({
      recipient,
      recipientType,
      otpHash: sha256(otp),
      otpType: request.otp_type,
      expiresAt,
    });
    return {
      message: `OTP generated for ${recipientType}`,
      otp_type: request.otp_type,
      recipient_type: recipientType,
      expires_in_minutes: ttl,
      otp,
    };
  }

  async signupPatient(request: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    date_of_birth: string;
    user_agreement_consent: boolean;
    role: string;
  }): Promise<Record<string, unknown>> {
    const existing = await this.data.findUserByEmail(request.email);
    if (existing?.role === 'patient') {
      throw new Error('Patient email already exists');
    }
    if (existing && existing.role !== 'patient') {
      throw new Error('Email already exists');
    }
    const patients = await this.data.listUsersByRole('patient');
    if (
      patients.some(
        (p) => (p.metadata as UserMetadata | null)?.phone === request.phone,
      )
    ) {
      throw new Error('Patient phone already exists');
    }
    await this.data.createUser({
      email: request.email,
      passwordHash: null,
      role: 'patient',
      locationCode: null,
      metadata: {
        first_name: request.first_name,
        last_name: request.last_name,
        phone: request.phone,
        date_of_birth: request.date_of_birth,
        user_agreement_consent: request.user_agreement_consent,
      },
    });
    const otp = this.generate4DigitOtp();
    const ttl = env.patientOtpTtlMinutes;
    const expiresAt = new Date(Date.now() + ttl * 60_000);
    await this.data.createLoginOtp({
      recipient: request.phone,
      recipientType: 'phone',
      otpHash: sha256(otp),
      otpType: 'signup',
      expiresAt,
    });
    return {
      message: 'Patient signup successful. OTP generated for phone',
      otp_type: 'signup',
      expires_in_minutes: ttl,
      otp,
    };
  }

  async verifyOtp(
    request: {
      otp_type: string;
      role: 'doctor' | 'staff' | 'patient';
      code: string;
      email?: string;
      phone?: string;
    },
    ipAddress?: string | null,
  ): Promise<Record<string, unknown>> {
    const recipientType = request.email ? 'email' : 'phone';
    const recipient = request.email
      ? request.email.toLowerCase()
      : (request.phone ?? '');
    const codeHash = sha256(request.code);
    const record = await this.data.getPendingLoginOtp({
      recipient,
      recipientType,
      otpType: request.otp_type,
    });
    if (!record || record.otpHash !== codeHash) {
      throw new AuthenticationError('Invalid or expired OTP');
    }
    await this.data.markLoginOtpUsed(record.id);

    if (request.otp_type === 'forgot_password') {
      if (
        (request.role === 'doctor' || request.role === 'staff') &&
        request.email
      ) {
        const ttlSeconds = env.stepUpTokenTtlMinutes * 60;
        const resetToken = issueResetPasswordToken({
          email: request.email,
          role: request.role,
          ttlSeconds,
        });
        return {
          verified: true,
          otp_type: request.otp_type,
          token: resetToken,
          expires_in_seconds: ttlSeconds,
        };
      }
      return { verified: true, otp_type: request.otp_type };
    }

    if (request.otp_type === 'backupcode') {
      if (!request.email) {
        throw new AuthenticationError(
          'email is required for backupcode verify',
        );
      }
      const user = await this.data.findUserByEmail(request.email);
      if (!user) throw new AuthenticationError('User not found');
      if (!DOCTOR_USER_ROLES.has(user.role)) {
        throw new AuthenticationError('User role is not allowed');
      }
      const codes = (user.backupCodes as BackupCodeEntry[] | null) ?? [];
      return {
        verified: true,
        otp_type: request.otp_type,
        backup_codes: codes,
      };
    }

    if (request.role === 'doctor' && request.otp_type === 'login') {
      if (!request.email) {
        throw new AuthenticationError('email is required for doctor verify');
      }
      const user = await this.data.findUserByEmail(request.email);
      if (!user) throw new AuthenticationError('User not found');
      if (!DOCTOR_USER_ROLES.has(user.role)) {
        throw new AuthenticationError(
          'User role does not match selected login role',
        );
      }
      await this.data.resetUserFailedAttempts(user.userId);
      return this.issueTokensForUser(user, ipAddress);
    }

    if (
      request.role === 'patient' &&
      (request.otp_type === 'login' || request.otp_type === 'signup')
    ) {
      const patientUser = await this.findPatientByPhone(request.phone ?? '');
      if (!patientUser) throw new AuthenticationError('Patient not found');
      await this.data.resetUserFailedAttempts(patientUser.userId);
      return this.issueTokensForUser(patientUser, ipAddress);
    }

    if (request.otp_type === 'faceId') {
      const user = await this.resolveUserFromRequest(request);
      await this.data.updateUserById(user.userId, { faceIdSet: true });
      return {
        verified: true,
        otp_type: request.otp_type,
        faceIdSet: true,
      };
    }

    if (request.otp_type === 'pinOtp') {
      return { verified: true, otp_type: request.otp_type };
    }

    throw new AuthenticationError('Unsupported verification flow');
  }

  async resetPassword(request: {
    token: string;
    role: 'doctor' | 'staff' | 'patient';
    email: string;
    new_password: string;
  }): Promise<{ password_reset: boolean }> {
    let payload: ResetPasswordPayload;
    try {
      payload = decodeToken<ResetPasswordPayload>(
        request.token,
        'reset_password',
      );
    } catch (err) {
      throw new AuthenticationError(
        err instanceof TokenError ? err.message : 'Invalid token',
      );
    }
    if (payload.email !== request.email.toLowerCase()) {
      throw new AuthenticationError('Invalid reset token for email');
    }
    if (payload.role !== request.role) {
      throw new AuthenticationError('Invalid reset token for role');
    }
    const user = await this.data.findUserByEmail(request.email);
    if (!user) throw new AuthenticationError('User not found');
    if (request.role === 'doctor' && !DOCTOR_USER_ROLES.has(user.role)) {
      throw new AuthenticationError(
        'User role does not match selected login role',
      );
    }
    if (request.role === 'staff' && !STAFF_USER_ROLES.has(user.role)) {
      throw new AuthenticationError(
        'User role does not match selected login role',
      );
    }
    const newHash = await hashPassword(request.new_password);
    await this.data.updateUserById(user.userId, { passwordHash: newHash });
    await this.data.revokeAllAuthSessionsForUser(user.userId);
    return { password_reset: true };
  }

  async refresh(refreshToken: string): Promise<TokenResponse> {
    let payload;
    try {
      payload = decodeToken<{ session_id: string; type: string }>(
        refreshToken,
        'refresh',
      );
    } catch (err) {
      throw new AuthenticationError(
        err instanceof TokenError ? err.message : 'Invalid token',
      );
    }
    const stored = await this.data.getActiveRefreshToken(refreshToken);
    if (!stored) {
      throw new AuthenticationError(
        'Refresh token has been revoked or already used',
      );
    }
    const authSession = await this.data.getActiveAuthSession(
      payload.session_id,
    );
    if (!authSession) {
      throw new AuthenticationError('Session expired or revoked');
    }
    const user = await this.data.findUserById(authSession.userId);
    if (!user?.isActive) {
      throw new AuthenticationError('User account unavailable');
    }
    const tokens = await this.issueTokens(user, authSession);
    await this.data.revokeRefreshToken(refreshToken, tokens.refresh_token);
    logger.info('Token refreshed', { sessionId: authSession.sessionId });
    return tokens;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.data.revokeAuthSession(sessionId);
    await this.data.revokeAllRefreshTokensForSession(sessionId);
    logger.info('Session revoked', { sessionId });
  }

  async createUser(request: {
    email: string;
    password: string;
    role: string;
    location_code?: string;
  }): Promise<UserResponse> {
    if (await this.data.findUserByEmail(request.email)) {
      throw new Error(`User already exists: ${request.email}`);
    }
    const hashed = await hashPassword(request.password);
    const user = await this.data.createUser({
      email: request.email,
      passwordHash: hashed,
      role: request.role,
      locationCode: request.location_code ?? null,
    });
    return this.toUserResponse(user);
  }

  async registerUser(request: {
    name: string;
    email: string;
    phone: string;
    password: string;
    date_of_birth: string;
    role: string;
  }): Promise<UserResponse> {
    if (await this.data.findUserByEmail(request.email)) {
      throw new Error(`User already exists with email: ${request.email}`);
    }
    const existing = await this.data.listUsersByRole(request.role);
    if (
      existing.some(
        (u) => (u.metadata as UserMetadata | null)?.phone === request.phone,
      )
    ) {
      throw new Error('User already exists with this phone number');
    }
    const hashed = await hashPassword(request.password);
    const user = await this.data.createUser({
      email: request.email,
      passwordHash: hashed,
      role: request.role,
      locationCode: null,
      metadata: {
        name: request.name,
        phone: request.phone,
        date_of_birth: request.date_of_birth,
      },
    });
    return this.toUserResponse(user);
  }

  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await this.data.findUserById(userId);
    if (!user) throw new Error('User not found');
    return this.toUserResponse(user);
  }

  async setPin(request: { user_id: string; pin: string }): Promise<{
    userPinSet: boolean;
    pinOtpSet: boolean;
  }> {
    const user = await this.data.findUserById(request.user_id);
    if (!user) throw new Error('User not found');
    const pinHash = await hashPin(request.pin);
    await this.data.updateUserById(request.user_id, {
      userPinHash: pinHash,
      userPinSet: true,
    });
    return { userPinSet: true, pinOtpSet: true };
  }

  async generateBackupCode(request: {
    email: string;
  }): Promise<Record<string, unknown>> {
    const user = await this.data.findUserByEmail(request.email);
    if (!user) throw new AuthenticationError('User not found');
    if (!DOCTOR_USER_ROLES.has(user.role)) {
      throw new AuthenticationError(
        'Only physician or covering_md roles can generate backup codes',
      );
    }
    const existing = (user.backupCodes as BackupCodeEntry[] | null) ?? [];
    if (!existing.length || existing.every((c) => c.isUsed)) {
      const newCodes: BackupCodeEntry[] = Array.from({ length: 10 }, () => ({
        code: String(randomInt(1000, 10000)),
        isUsed: false,
      }));
      await this.data.updateUserById(user.userId, {
        backupCodes: newCodes as Prisma.InputJsonValue,
      });
    }
    const otp = this.generate4DigitOtp();
    const ttl = env.patientOtpTtlMinutes;
    const expiresAt = new Date(Date.now() + ttl * 60_000);
    await this.data.createLoginOtp({
      recipient: user.email,
      recipientType: 'email',
      otpHash: sha256(otp),
      otpType: 'backupcode',
      expiresAt,
    });
    return {
      message: 'Backup code OTP sent to your email',
      otp_type: 'backupcode',
      expires_in_minutes: ttl,
      otp,
    };
  }

  async verifyBackupCode(
    email: string,
    backupcode: string,
  ): Promise<{ verified: boolean; message: string }> {
    const user = await this.data.findUserByEmail(email);
    if (!user) throw new AuthenticationError('User not found');
    if (!DOCTOR_USER_ROLES.has(user.role)) {
      throw new AuthenticationError(
        'Only physician or covering_md roles can use backup codes',
      );
    }
    const codes = (user.backupCodes as BackupCodeEntry[] | null) ?? [];
    if (!codes.length) {
      throw new AuthenticationError(
        'No backup codes found. Please generate backup codes first.',
      );
    }
    for (const entry of codes) {
      if (entry.code === backupcode) {
        if (entry.isUsed) {
          throw new AuthenticationError(
            'This backup code has already been used',
          );
        }
        entry.isUsed = true;
        await this.data.updateUserById(user.userId, {
          backupCodes: codes as Prisma.InputJsonValue,
        });
        await this.data.resetUserFailedAttempts(user.userId);
        return {
          verified: true,
          message: 'Backup code verified successfully',
        };
      }
    }
    throw new AuthenticationError('Invalid backup code');
  }

  async verifyPin(
    userId: string,
    pin: string,
  ): Promise<{ verified: boolean; message: string }> {
    const user = await this.data.getUserById(userId);

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      throw new AuthenticationError(
        `Account locked due to too many failed attempts. Try again after ${user.lockedUntil.toISOString()}`,
        {
          failedAttempts: user.failedAttempts,
          maxAttempts: PIN_MAX_ATTEMPTS,
          remainingAttempts: 0,
          lockedUntil: user.lockedUntil.toISOString(),
        },
      );
    }
    if (!user.userPinSet || !user.userPinHash) {
      throw new AuthenticationError('PIN is not set for this user');
    }

    const valid = await verifyPin(pin, user.userPinHash);
    if (!valid) {
      const newCount = user.failedAttempts + 1;
      let lockedUntil: Date | null = null;
      if (newCount >= PIN_MAX_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + env.lockoutMinutes * 60_000);
      }
      await this.data.incrementUserFailedAttempts(user.userId, lockedUntil);
      if (newCount >= PIN_MAX_ATTEMPTS) {
        throw new AuthenticationError(
          'Account locked due to too many failed attempts',
          {
            failedAttempts: newCount,
            maxAttempts: PIN_MAX_ATTEMPTS,
            remainingAttempts: 0,
            lockedUntil: lockedUntil?.toISOString() ?? null,
          },
        );
      }
      throw new AuthenticationError('Invalid PIN', {
        failedAttempts: newCount,
        maxAttempts: PIN_MAX_ATTEMPTS,
        remainingAttempts: Math.max(0, PIN_MAX_ATTEMPTS - newCount),
      });
    }
    await this.data.resetUserFailedAttempts(user.userId);
    return { verified: true, message: 'PIN verified successfully' };
  }

  async updateUserFlags(
    userId: string,
    request: { faceIdSet?: boolean; failedAttempts?: number },
  ): Promise<Record<string, unknown>> {
    const user = await this.data.findUserById(userId);
    if (!user) throw new Error('User not found');
    const response: Record<string, unknown> = {};
    if (request.faceIdSet !== undefined) {
      await this.data.updateUserById(userId, { faceIdSet: request.faceIdSet });
      response.faceIdSet = request.faceIdSet;
    }
    if (request.failedAttempts !== undefined) {
      let lockedUntil: Date | null = null;
      if (request.failedAttempts >= PIN_MAX_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + env.lockoutMinutes * 60_000);
      }
      await this.data.updateUserById(userId, {
        failedAttempts: request.failedAttempts,
        lockedUntil,
        isLocked: lockedUntil !== null,
      });
      response.failed_attempts = request.failedAttempts;
      if (lockedUntil) {
        response.locked_until = lockedUntil.toISOString();
      }
    }
    return response;
  }

  async deactivateUser(userId: string): Promise<void> {
    const user = await this.data.findUserById(userId);
    if (!user) throw new Error('User not found');
    await this.data.updateUserById(userId, { isActive: false });
    await this.data.revokeAllAuthSessionsForUser(userId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.data.getUserById(userId);
    const valid = await verifyPassword(
      currentPassword,
      user.passwordHash ?? '',
    );
    if (!valid) {
      throw new AuthenticationError('Current password is incorrect');
    }
    const newHash = await hashPassword(newPassword);
    await this.data.updateUserById(userId, { passwordHash: newHash });
    await this.data.revokeAllAuthSessionsForUser(userId);
  }

  async enableMfa(userId: string): Promise<{
    secret: string;
    provisioning_uri: string;
  }> {
    const user = await this.data.findUserById(userId);
    if (!user) throw new Error('User not found');
    const secret = authenticator.generateSecret();
    const provisioningUri = authenticator.keyuri(
      user.email,
      env.mfaIssuer,
      secret,
    );
    await this.data.updateUserById(userId, {
      mfaSecret: secret,
      mfaEnabled: false,
    });
    return { secret, provisioning_uri: provisioningUri };
  }

  async verifyMfaSetup(userId: string, code: string): Promise<string[]> {
    const user = await this.data.findUserById(userId);
    if (!user?.mfaSecret) {
      throw new Error('MFA setup not initiated');
    }
    if (!this.verifyTotp(user.mfaSecret, code)) {
      throw new AuthenticationError('Invalid MFA code');
    }
    await this.data.updateUserById(userId, {
      mfaSecret: user.mfaSecret,
      mfaEnabled: true,
    });
    return Array.from({ length: 8 }, () =>
      randomBytes(4).toString('hex').toUpperCase(),
    );
  }

  async disableMfa(userId: string, code: string): Promise<void> {
    const user = await this.data.findUserById(userId);
    if (!user?.mfaEnabled) {
      throw new Error('MFA is not enabled');
    }
    if (!this.verifyTotp(user.mfaSecret ?? '', code)) {
      throw new AuthenticationError('Invalid MFA code');
    }
    await this.data.updateUserById(userId, {
      mfaSecret: null,
      mfaEnabled: false,
    });
  }

  async createApiKey(params: {
    userId: string;
    name: string;
    scopes: string[];
    expiresDays: number | null;
  }) {
    const rawKey = generateApiKey();
    const expiresAt = params.expiresDays
      ? new Date(Date.now() + params.expiresDays * 86_400_000)
      : null;
    const record = await this.data.createApiKey({
      userId: params.userId,
      name: params.name,
      rawKey,
      scopes: params.scopes,
      expiresAt,
    });
    return {
      key_id: record.keyId,
      name: record.name,
      api_key: rawKey,
      key_prefix: record.keyPrefix,
      expires_at: record.expiresAt,
    };
  }

  async listApiKeys(userId: string) {
    const records = await this.data.listApiKeysForUser(userId);
    return records.map((r) => ({
      key_id: r.keyId,
      name: r.name,
      key_prefix: r.keyPrefix,
      scopes: parseJsonStringArray(r.scopes),
      expires_at: r.expiresAt,
      last_used_at: r.lastUsedAt,
    }));
  }

  async revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    return this.data.revokeApiKey(keyId, userId);
  }

  async createBreakGlassSession(params: {
    userId: string;
    reason: string;
    ipAddress?: string | null;
  }) {
    const user = await this.data.findUserById(params.userId);
    if (!user) throw new Error('User not found');
    const expiresAt = new Date(Date.now() + 4 * 3_600_000);
    const authSession = await this.data.createAuthSession({
      userId: params.userId,
      authMethod: 'break_glass',
      role: user.role,
      locationCode: user.locationCode,
      deviceId: null,
      ipAddress: params.ipAddress ?? null,
      expiresAt,
      isBreakGlass: true,
    });
    await this.data.createBreakGlassEvent({
      userId: params.userId,
      sessionId: authSession.sessionId,
      reason: params.reason,
      expiresAt,
    });
    logger.warn('Break-glass activated', {
      userId: params.userId,
      sessionId: authSession.sessionId,
      reason: params.reason,
    });
    const tokens = await this.issueTokens(user, authSession);
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
      auth_session_id: tokens.auth_session_id,
      break_glass: true,
      reason: params.reason,
    };
  }

  async requestPatientOtp(phone: string): Promise<Record<string, unknown>> {
    const otp = String(randomInt(100000, 999999));
    const phoneHash = sha256(phone);
    const otpHash = sha256(otp);
    const ttl = env.patientOtpTtlMinutes;
    const otpExpiresAt = new Date(Date.now() + ttl * 60_000);
    await this.data.createPatientTokenOtp({ phoneHash, otpHash, otpExpiresAt });
    if (env.integrationMode === 'stub') {
      return { message: `OTP sent (stub: ${otp})`, expires_in_minutes: ttl };
    }
    return { message: 'OTP sent to phone', expires_in_minutes: ttl };
  }

  async verifyPatientOtp(phone: string, otp: string) {
    const phoneHash = sha256(phone);
    const otpHash = sha256(otp);
    const record = await this.data.getPendingPatientToken(phoneHash);
    if (!record || record.otpHash !== otpHash) {
      throw new AuthenticationError('Invalid or expired OTP');
    }
    const rawToken = generatePatientToken();
    const tokenExpiresAt = new Date(
      Date.now() + env.patientTokenTtlHours * 3_600_000,
    );
    await this.data.verifyPatientToken(record.id, rawToken, tokenExpiresAt);
    return {
      patient_token: rawToken,
      expires_at: tokenExpiresAt,
    };
  }

  private async issueTokensForUser(
    user: User,
    ipAddress?: string | null,
  ): Promise<Record<string, unknown>> {
    const expiresAt = new Date(
      Date.now() + env.refreshTokenTtlDays * 86_400_000,
    );
    const authSession = await this.data.createAuthSession({
      userId: user.userId,
      authMethod: 'otp',
      role: user.role,
      locationCode: user.locationCode,
      deviceId: null,
      ipAddress: ipAddress ?? null,
      expiresAt,
    });
    await this.data.updateUserById(user.userId, { lastLoginAt: new Date() });
    const tokens = await this.issueTokens(user, authSession);
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: this.toUserResponse(user),
    };
  }

  private async validateStaffCredentials(params: {
    email: string;
    password: string;
    allowedRoles: Set<string>;
    mfaCode?: string;
  }): Promise<User> {
    const user = await this.data.findUserByEmail(params.email);
    const now = new Date();

    if (user) {
      if (!user.isActive) {
        throw new AuthenticationError('Account is deactivated');
      }
      if (user.lockedUntil && user.lockedUntil > now) {
        throw new AuthenticationError(
          `Account locked until ${user.lockedUntil.toISOString()}`,
        );
      }
    }

    const valid = user
      ? await verifyPassword(params.password, user.passwordHash ?? '')
      : false;
    if (!user || !valid) {
      logger.warn('Auth failure', { email: params.email });
      throw new AuthenticationError('Invalid credentials');
    }
    if (!params.allowedRoles.has(user.role)) {
      throw new AuthenticationError(
        'User role does not match selected login role',
      );
    }
    if (user.mfaEnabled) {
      if (!params.mfaCode) {
        throw new AuthenticationError('MFA code required');
      }
      if (!this.verifyTotp(user.mfaSecret ?? '', params.mfaCode)) {
        logger.warn('Auth failure — invalid MFA', { email: params.email });
        throw new AuthenticationError('Invalid MFA code');
      }
    }
    return user;
  }

  private async issueTokens(
    user: User,
    authSession: { sessionId: string; role: string },
  ): Promise<TokenResponse> {
    const accessTtl = env.accessTokenTtlMinutes * 60;
    const refreshTtl = env.refreshTokenTtlDays * 86_400;
    const refreshExpiresAt = new Date(Date.now() + refreshTtl * 1000);
    const rawRefresh = issueRefreshToken({
      sessionId: authSession.sessionId,
      ttlSeconds: refreshTtl,
    });
    await this.data.storeRefreshToken({
      rawToken: rawRefresh,
      sessionId: authSession.sessionId,
      userId: user.userId,
      expiresAt: refreshExpiresAt,
    });
    return {
      access_token: issueAccessToken({
        userId: user.userId,
        role: authSession.role,
        sessionId: authSession.sessionId,
        ttlSeconds: accessTtl,
      }),
      refresh_token: rawRefresh,
      token_type: 'bearer',
      expires_in: accessTtl,
      auth_session_id: authSession.sessionId,
    };
  }

  private toUserResponse(user: User): UserResponse {
    const metadata = (user.metadata as UserMetadata | null) ?? {};
    return {
      user_id: user.userId,
      email: user.email,
      name: metadata.name ?? metadata.first_name ?? '',
      phone: metadata.phone ?? null,
      date_of_birth: metadata.date_of_birth ?? null,
      role: user.role,
      location_code: user.locationCode,
      is_active: user.isActive,
      mfa_enabled: user.mfaEnabled,
      userPinSet: user.userPinSet,
      faceIdSet: user.faceIdSet,
      last_login_at: user.lastLoginAt,
    };
  }

  private verifyTotp(secret: string, code: string): boolean {
    try {
      return authenticator.verify({ token: code, secret });
    } catch {
      return false;
    }
  }

  private generate4DigitOtp(): string {
    return String(randomInt(1000, 10000));
  }

  private async findPatientByPhone(phone: string): Promise<User | null> {
    const patients = await this.data.listUsersByRole('patient');
    return (
      patients.find(
        (u) => (u.metadata as UserMetadata | null)?.phone === phone,
      ) ?? null
    );
  }

  private async resolveUserFromRequest(request: {
    role: string;
    email?: string;
    phone?: string;
  }): Promise<User> {
    if (request.role === 'doctor' || request.role === 'staff') {
      if (!request.email) {
        throw new AuthenticationError('email is required');
      }
      const user = await this.data.findUserByEmail(request.email);
      if (!user) throw new AuthenticationError('User not found');
      return user;
    }
    if (request.role === 'patient') {
      if (!request.phone) {
        throw new AuthenticationError('phone is required');
      }
      const user = await this.findPatientByPhone(request.phone);
      if (!user) throw new AuthenticationError('Patient not found');
      return user;
    }
    throw new AuthenticationError('Unsupported role for OTP verification');
  }

  async bookAppointment(
    patientId: string,
    reason: string,
    insuranceName: string,
    providerName: string,
  ) {
    const patient = await this.data.findUserById(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }
    if (patient.role !== 'patient') {
      throw new Error('User is not a patient');
    }
    return this.data.createAppointment({
      patientId,
      reason,
      insuranceName,
      providerName,
    });
  }
}

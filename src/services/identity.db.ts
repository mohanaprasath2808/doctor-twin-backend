import {
  ApiKey,
  Appointment,
  AuthSession,
  Otp,
  PatientToken,
  Prisma,
  RefreshToken,
  User,
} from '@prisma/client';
import { AuthenticationError } from '../errors/AuthenticationError';
import { DbClient } from '../types/prisma.types';
import { UserMetadata } from '../types/identity.types';
import { sha256 } from '../utils/hash.util';

/**
 * Predefined Prisma accessors for the identity domain.
 * Used by IdentityService — routes → controllers → services → (this) → Prisma.
 */
export class IdentityDb {
  constructor(private readonly prisma: DbClient) {}

  // ── User ────────────────────────────────────────────────────────────────────

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { userId } });
  }

  async getUserById(userId: string): Promise<User> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    return user;
  }

  async updateUserById(
    userId: string,
    updateBody: Prisma.UserUpdateInput,
  ): Promise<User> {
    await this.getUserById(userId);
    return this.prisma.user.update({
      where: { userId },
      data: updateBody,
    });
  }

  async createUser(data: {
    email: string;
    passwordHash: string | null;
    role: string;
    locationCode?: string | null;
    metadata?: UserMetadata;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        role: data.role,
        locationCode: data.locationCode ?? null,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async listUsersByRole(role: string): Promise<User[]> {
    return this.prisma.user.findMany({ where: { role } });
  }

  async resetUserFailedAttempts(userId: string): Promise<void> {
    await this.updateUserById(userId, {
      failedAttempts: 0,
      lockedUntil: null,
      isLocked: false,
    });
  }

  async incrementUserFailedAttempts(
    userId: string,
    lockedUntil: Date | null,
  ): Promise<void> {
    const user = await this.getUserById(userId);
    await this.prisma.user.update({
      where: { userId },
      data: {
        failedAttempts: user.failedAttempts + 1,
        ...(lockedUntil ? { lockedUntil, isLocked: true } : {}),
      },
    });
  }

  // ── Auth sessions ───────────────────────────────────────────────────────────

  async createAuthSession(data: {
    userId: string;
    authMethod: string;
    role: string;
    locationCode: string | null;
    deviceId: string | null;
    ipAddress: string | null;
    expiresAt: Date;
    isBreakGlass?: boolean;
  }): Promise<AuthSession> {
    return this.prisma.authSession.create({
      data: {
        userId: data.userId,
        authMethod: data.authMethod,
        role: data.role,
        locationCode: data.locationCode,
        deviceId: data.deviceId,
        ipAddress: data.ipAddress,
        expiresAt: data.expiresAt,
        isBreakGlass: data.isBreakGlass ?? false,
      },
    });
  }

  async getActiveAuthSession(sessionId: string): Promise<AuthSession | null> {
    const now = new Date();
    return this.prisma.authSession.findFirst({
      where: { sessionId, isActive: true, expiresAt: { gt: now } },
    });
  }

  async revokeAuthSession(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { sessionId },
      data: { isActive: false },
    });
  }

  async revokeAllAuthSessionsForUser(userId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId },
      data: { isActive: false },
    });
  }

  // ── API keys ────────────────────────────────────────────────────────────────

  async createApiKey(data: {
    userId: string;
    name: string;
    rawKey: string;
    scopes: string[];
    expiresAt: Date | null;
  }): Promise<ApiKey> {
    return this.prisma.apiKey.create({
      data: {
        userId: data.userId,
        name: data.name,
        keyHash: sha256(data.rawKey),
        keyPrefix: data.rawKey.slice(0, 12),
        scopes: data.scopes as Prisma.InputJsonValue,
        expiresAt: data.expiresAt,
      },
    });
  }

  async listApiKeysForUser(userId: string): Promise<ApiKey[]> {
    return this.prisma.apiKey.findMany({
      where: { userId, isActive: true },
    });
  }

  async revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.apiKey.updateMany({
      where: { keyId, userId },
      data: { isActive: false },
    });
    return result.count > 0;
  }

  // ── Refresh tokens ──────────────────────────────────────────────────────────

  async storeRefreshToken(data: {
    rawToken: string;
    sessionId: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: sha256(data.rawToken),
        sessionId: data.sessionId,
        userId: data.userId,
        expiresAt: data.expiresAt,
      },
    });
  }

  async getActiveRefreshToken(rawToken: string): Promise<RefreshToken | null> {
    const now = new Date();
    return this.prisma.refreshToken.findFirst({
      where: {
        tokenHash: sha256(rawToken),
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });
  }

  async revokeRefreshToken(
    rawToken: string,
    replacedBy: string | null,
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawToken) },
      data: {
        revokedAt: new Date(),
        replacedByHash: replacedBy ? sha256(replacedBy) : null,
      },
    });
  }

  async revokeAllRefreshTokensForSession(sessionId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── Break-glass ─────────────────────────────────────────────────────────────

  async createBreakGlassEvent(data: {
    userId: string;
    sessionId: string;
    reason: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.breakGlassEvent.create({ data });
  }

  // ── Patient tokens (legacy phone OTP flow) ──────────────────────────────────

  async createPatientTokenOtp(data: {
    phoneHash: string;
    otpHash: string;
    otpExpiresAt: Date;
  }): Promise<PatientToken> {
    return this.prisma.patientToken.create({ data });
  }

  async getPendingPatientToken(phoneHash: string): Promise<PatientToken | null> {
    const now = new Date();
    return this.prisma.patientToken.findFirst({
      where: {
        phoneHash,
        verified: false,
        otpExpiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verifyPatientToken(
    recordId: number,
    patientToken: string,
    tokenExpiresAt: Date,
  ): Promise<void> {
    await this.prisma.patientToken.update({
      where: { id: recordId },
      data: { verified: true, patientToken, tokenExpiresAt },
    });
  }

  // ── Login OTP ───────────────────────────────────────────────────────────────

  async createLoginOtp(data: {
    recipient: string;
    recipientType: string;
    otpHash: string;
    otpType: string;
    expiresAt: Date;
  }): Promise<Otp> {
    return this.prisma.otp.create({ data });
  }

  async getPendingLoginOtp(params: {
    recipient: string;
    recipientType: string;
    otpType: string;
  }): Promise<Otp | null> {
    const now = new Date();
    return this.prisma.otp.findFirst({
      where: {
        recipient: params.recipient,
        recipientType: params.recipientType,
        otpType: params.otpType,
        used: false,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markLoginOtpUsed(otpId: number): Promise<void> {
    await this.prisma.otp.update({
      where: { id: otpId },
      data: { used: true },
    });
  }

  // ── Appointments ────────────────────────────────────────────────────────────

  async createAppointment(data: {
    patientId: string;
    reason: string;
    insuranceName: string;
    providerName: string;
  }): Promise<Appointment> {
    return this.prisma.appointment.create({
      data: {
        patientId: data.patientId,
        reason: data.reason,
        insuranceName: data.insuranceName,
        providerName: data.providerName,
      },
    });
  }
}

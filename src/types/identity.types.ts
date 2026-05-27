import { Prisma } from '@prisma/client';

export type UserMetadata = {
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  date_of_birth?: string;
  user_agreement_consent?: boolean;
};

export type BackupCodeEntry = {
  code: string;
  isUsed: boolean;
};

export type TokenPayload = {
  sub: string;
  role: string;
  session_id: string;
  type: 'access';
  iat: number;
  exp: number;
};

export type RefreshPayload = {
  session_id: string;
  type: 'refresh';
  iat: number;
  exp: number;
};

export type ResetPasswordPayload = {
  email: string;
  role: string;
  type: 'reset_password';
  iat: number;
  exp: number;
};

export type AuthContext = {
  sub: string;
  role: string;
  session_id: string;
};

export type UserResponse = {
  user_id: string;
  email: string;
  name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  role: string;
  location_code: string | null;
  is_active: boolean;
  mfa_enabled: boolean;
  userPinSet: boolean;
  faceIdSet: boolean;
  last_login_at: Date | null;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  auth_session_id: string;
};

export type PrismaUser = Prisma.UserGetPayload<Record<string, never>>;

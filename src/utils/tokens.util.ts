import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import {
  RefreshPayload,
  ResetPasswordPayload,
  TokenPayload,
} from '../types/identity.types';

const ALGORITHM = 'HS256';

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenError';
  }
}

export const issueAccessToken = (params: {
  userId: string;
  role: string;
  sessionId: string;
  ttlSeconds: number;
}): string => {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: params.userId,
    role: params.role,
    session_id: params.sessionId,
    type: 'access',
    iat: now,
    exp: now + params.ttlSeconds,
  };
  return jwt.sign(payload, env.jwtSecret, { algorithm: ALGORITHM });
};

export const issueRefreshToken = (params: {
  sessionId: string;
  ttlSeconds: number;
}): string => {
  const now = Math.floor(Date.now() / 1000);
  const payload: RefreshPayload = {
    session_id: params.sessionId,
    type: 'refresh',
    iat: now,
    exp: now + params.ttlSeconds,
  };
  return jwt.sign(payload, env.jwtSecret, { algorithm: ALGORITHM });
};

export const issueResetPasswordToken = (params: {
  email: string;
  role: string;
  ttlSeconds: number;
}): string => {
  const now = Math.floor(Date.now() / 1000);
  const payload: ResetPasswordPayload = {
    email: params.email.toLowerCase(),
    role: params.role,
    type: 'reset_password',
    iat: now,
    exp: now + params.ttlSeconds,
  };
  return jwt.sign(payload, env.jwtSecret, { algorithm: ALGORITHM });
};

export const decodeToken = <T extends jwt.JwtPayload>(
  token: string,
  tokenType?: string,
): T => {
  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      algorithms: [ALGORITHM],
    }) as T;
    if (tokenType && (payload as jwt.JwtPayload).type !== tokenType) {
      throw new TokenError(
        `Expected token type '${tokenType}', got '${(payload as jwt.JwtPayload).type}'`,
      );
    }
    return payload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new TokenError('Token has expired');
    }
    if (err instanceof TokenError) throw err;
    throw new TokenError(
      err instanceof Error ? `Invalid token: ${err.message}` : 'Invalid token',
    );
  }
};

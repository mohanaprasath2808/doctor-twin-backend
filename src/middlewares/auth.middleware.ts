import { Request, Response, NextFunction, RequestHandler } from 'express';
import prisma from '../client';
import { AuthContext } from '../types/identity.types';
import { sendError } from '../utils/apiEnvelope';
import { sha256 } from '../utils/hash.util';
import { decodeToken, TokenError } from '../utils/tokens.util';

const extractBearer = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
};

const resolveApiKey = async (apiKey: string): Promise<AuthContext | null> => {
  const now = new Date();
  const record = await prisma.apiKey.findFirst({
    where: {
      keyHash: sha256(apiKey),
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
  if (!record) return null;
  await prisma.apiKey.update({
    where: { keyId: record.keyId },
    data: { lastUsedAt: new Date() },
  });
  return {
    sub: record.userId,
    role: 'api',
    session_id: `apikey-${record.keyId}`,
  };
};

export const resolveAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const bearer = extractBearer(req);
  if (bearer) {
    try {
      const payload = decodeToken<{
        sub: string;
        role: string;
        session_id: string;
      }>(bearer, 'access');
      req.auth = {
        sub: payload.sub,
        role: payload.role,
        session_id: payload.session_id,
      };
      return next();
    } catch (err) {
      const message =
        err instanceof TokenError ? err.message : 'Invalid token';
      sendError(res, 401, message);
      return;
    }
  }

  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey === 'string' && apiKey.length > 0) {
    const ctx = await resolveApiKey(apiKey);
    if (ctx) {
      req.auth = ctx;
      return next();
    }
    sendError(res, 401, 'Invalid or expired API key');
    return;
  }

  res.setHeader('WWW-Authenticate', 'Bearer');
  sendError(res, 401, 'Not authenticated');
};

export const currentUser: RequestHandler = (req, res, next) => {
  void resolveAuth(req, res, next);
};

export const requireRole =
  (allowedRoles: Set<string>): RequestHandler =>
  (req, res, next) => {
    void resolveAuth(req, res, (err) => {
      if (err) return next(err);
      if (!req.auth) return;
      const { role } = req.auth;
      if (!allowedRoles.has(role) && role !== 'admin') {
        sendError(
          res,
          403,
          `Role '${role}' is not permitted for this endpoint`,
        );
        return;
      }
      next();
    });
  };

import type { AuthContext } from './identity.types';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

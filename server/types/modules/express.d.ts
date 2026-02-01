import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      client_build?: string;
      account?: any;
      fingerprint?: string;
      is_staff?: boolean;
    }
  }
}

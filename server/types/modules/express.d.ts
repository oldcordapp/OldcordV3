import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      client_build?: string; // or whatever type your build is
    }
  }
}

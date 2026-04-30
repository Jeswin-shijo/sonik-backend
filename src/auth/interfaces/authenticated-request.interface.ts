import { Request } from 'express';

export type AuthenticatedRequest = Request & {
  user: {
    sub: number;
    email: string;
    profileName: string;
    authProvider: 'local' | 'google' | 'hybrid';
    iat?: number;
    exp?: number;
  };
};

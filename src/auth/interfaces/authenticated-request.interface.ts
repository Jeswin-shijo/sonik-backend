import { Request } from 'express';

export type AuthenticatedRequest = Request & {
  user: {
    sub: number;
    email: string;
    profileName: string;
    authProvider: 'local' | 'google' | 'hybrid';
    role: 'user' | 'admin';
    iat?: number;
    exp?: number;
  };
};

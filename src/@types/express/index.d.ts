import 'express-serve-static-core';
import type { AuthUser } from 'src/auth/auth.types';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

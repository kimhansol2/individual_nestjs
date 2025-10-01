import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

type Principal = { userId: number };
type AuthRequest = Request & { user?: Principal; _user?: Principal };

export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const id = req.user?.userId ?? req._user?.userId;
    if (typeof id !== 'number' || !Number.isSafeInteger(id)) {
      throw new UnauthorizedException('Invalid userId');
    }
    return id;
  },
);

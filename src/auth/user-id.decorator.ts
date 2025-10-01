import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const id = ctx.switchToHttp().getRequest().user?.userId;
    if (!Number.isSafeInteger(id)) {
      throw new UnauthorizedException('Invalid userId');
    }
    return id;
  },
);

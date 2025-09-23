import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const req = ctx.switchToHttp().getRequest();

    const raw = req?.user?.id ?? req?.user?.userId ?? req?.user?.sub;

    const id = Number(raw);
    if (!Number.isFinite(id)) {
      throw new BadRequestException(
        '요청에 userId가 없습니다. 인증 가드/JWT 설정을 확인하세요',
      );
    }
    return id;
  },
);

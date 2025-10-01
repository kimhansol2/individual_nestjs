import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
    // 필요에 따라 user 객체 구조에 맞게 추가 필드를 선언하세요
  };
}

@Injectable()
export class FriendsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    // user 프로퍼티가 없으면 인증 실패 처리
    if (!request.user) {
      throw new ForbiddenException('Access denied: user not authenticated');
    }

    // 필요 시 역할(Role) 기반 접근 제어 구현 가능
    // const roles = this.reflector.get<string[]>('roles', context.getHandler());
    // if (roles && !roles.includes(request.user.role)) {
    //   throw new ForbiddenException('Access denied: insufficient permissions');
    // }

    return true;
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthUser } from '../auth/auth.types'; // 경로가 정확한지 확인해 주세요

// AuthUser 타입을 직접 사용하도록 수정
interface RequestWithUser extends Request {
  user?: AuthUser; // 기존 객체 정의 대신 AuthUser 타입 사용
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

import { ExecutionContext, Injectable } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { Request } from 'express';

@Injectable()
export class UserScopedCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method !== 'GET') return undefined;

    const userId = req.user?.userId;
    if (!userId) return undefined;

    const url = req.originalUrl || req.url;
    return `u:${userId}:${url}`;
  }
}

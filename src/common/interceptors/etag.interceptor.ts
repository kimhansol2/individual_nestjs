import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable, of, EMPTY } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { createHash } from 'crypto';
import { PUBLIC_CACHE_KEY, PublicCacheOpts } from '../public-cache.decorator';

@Injectable()
export class EtagInterceptor<T> implements NestInterceptor<T, T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const meta = this.reflector.getAllAndOverride<PublicCacheOpts>(
      PUBLIC_CACHE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) return next.handle();

    if (req.method !== 'GET') return next.handle();

    const cacheControlHeader = String(res.getHeader('Cache-Control') ?? '');
    if (cacheControlHeader.includes('no-store')) return next.handle();

    // 공개 캐시 정책 세팅
    const maxAge = meta.maxAge ?? 300;
    const sMaxAge = meta.sMaxAge ?? 600;
    res.setHeader(
      'Cache-Control',
      `public, max-age=${maxAge}, s-maxage=${sMaxAge}, must-revalidate`,
    );

    //if-none-match 안전 추출
    const raw = req.headers['if-none-match'];

    const ifNoneMatch =
      typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;

    return next.handle().pipe(
      mergeMap((body: T) => {
        // 응답 바디 해시로 ETag 생성

        if (res.statusCode !== 200) return of(body);

        const hash = createHash('sha1')
          .update(JSON.stringify(body))
          .digest('hex');
        const etag = (meta.weak ?? true) ? `W/"${hash}"` : `"${hash}"`;

        //미리 ETag를 내려준다.
        res.setHeader('ETag', etag);

        if (ifNoneMatch && ifNoneMatch === etag) {
          res.status(304).end();
          return EMPTY as unknown as Observable<T>;
        }

        return of(body);
      }),
    );
  }
}

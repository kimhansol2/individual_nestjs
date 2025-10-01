import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, of, EMPTY } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { createHash } from 'crypto';

@Injectable()
export class EtagInterceptor<T> implements NestInterceptor<T, T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    // 인증 의존 응답임을 명시
    res.setHeader('Vary', 'Authorization');
    // 저장 대신 재검증
    res.setHeader('Cache-Control', 'private, no-cache');

    const ifNoneMatch = req.headers['if-none-match'];

    return next.handle().pipe(
      mergeMap((body: T) => {
        // 응답 바디 해시로 ETag 생성
        const etag =
          '"' +
          createHash('sha1').update(JSON.stringify(body)).digest('hex') +
          '"';

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

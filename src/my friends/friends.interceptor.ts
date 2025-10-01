import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express'; // Express Request 타입 추가

// user 프로퍼티를 포함하는 확장 Request 타입 정의
interface RequestWithUser extends Request {
  user?: {
    id: string;
    // 필요한 다른 user 속성들도 여기에 추가할 수 있어요
  };
}

// 단순 캐싱 메모리 저장소 (프로덕션에서는 Redis 추천)
const cacheStore = new Map<string, unknown>();

@Injectable()
export class FriendsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // 명확한 타입 지정
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const key = `${request.user?.id || 'anon'}:${request.url}`;

    // 캐싱 확인
    if (cacheStore.has(key)) {
      return of(cacheStore.get(key));
    }

    const now = Date.now();
    return next.handle().pipe(
      tap((data) => {
        // 응답 캐싱 저장
        cacheStore.set(key, data);

        // 로깅
        console.log(
          `[FriendsInterceptor] ${request.method} ${request.url} - ${
            Date.now() - now
          }ms`,
        );
      }),
    );
  }
}

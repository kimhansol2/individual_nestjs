import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class NoStoreIfAuthedInterceptor
  implements NestInterceptor<unknown, unknown>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const res = context.switchToHttp().getResponse();
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Vary', 'Authorization');
    return next.handle();
  }
}

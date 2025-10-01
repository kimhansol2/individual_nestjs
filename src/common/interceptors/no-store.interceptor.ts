import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Response } from 'express';

@Injectable()
export class NoStoreInterceptor implements NestInterceptor<unknown, unknown> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Vary', 'Authorization');
    return next.handle();
  }
}

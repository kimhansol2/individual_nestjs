// 호출 한도 초과
import { HttpException, HttpStatus } from '@nestjs/common';

export class RateLimitedException extends HttpException {
  constructor() {
    super(
      { message: '호출 한도 초과', code: 'RATE_LIMITED' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

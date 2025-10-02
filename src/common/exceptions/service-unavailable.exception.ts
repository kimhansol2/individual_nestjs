// 서킷 브레이커/일시차단
import { HttpException, HttpStatus } from '@nestjs/common';

export class ServiceUnavailableException extends HttpException {
  constructor() {
    super(
      { message: '서비스 일시 중단', code: 'SERVICE_UNAVAILABLE' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

// 일반 서버 오류
import { HttpException, HttpStatus } from '@nestjs/common';

export class InternalErrorException extends HttpException {
  constructor(message?: string) {
    super(
      { message: message || '서버 오류', code: 'INTERNAL_ERROR' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

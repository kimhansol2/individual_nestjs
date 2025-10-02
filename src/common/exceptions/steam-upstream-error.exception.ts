// Steam API 오류
import { HttpException, HttpStatus } from '@nestjs/common';

export class SteamUpstreamErrorException extends HttpException {
  constructor() {
    super(
      { message: 'Steam API 오류', code: 'STEAM_UPSTREAM_ERROR' },
      HttpStatus.BAD_GATEWAY,
    );
  }
}

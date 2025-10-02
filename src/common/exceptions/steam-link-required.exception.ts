// Steam 미연동
import { HttpException, HttpStatus } from '@nestjs/common';

export class SteamLinkRequiredException extends HttpException {
  constructor() {
    super(
      { message: 'Steam 계정 연동 필요', code: 'STEAM_LINK_REQUIRED' },
      HttpStatus.FORBIDDEN,
    );
  }
}

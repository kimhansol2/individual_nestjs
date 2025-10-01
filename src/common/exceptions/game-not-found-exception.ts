// 지원하지 않는/모르는 gameId
import { HttpException, HttpStatus } from '@nestjs/common';

export class GameNotFoundException extends HttpException {
  constructor(gameId: number) {
    super(
      { message: `게임을 찾을 수 없음: ${gameId}`, code: 'GAME_NOT_FOUND' },
      HttpStatus.NOT_FOUND,
    );
  }
}

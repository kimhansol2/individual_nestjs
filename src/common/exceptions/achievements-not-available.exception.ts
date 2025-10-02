// 해당 게임이 업적 시스템 미지원
import { HttpException, HttpStatus } from '@nestjs/common';

export class AchievementsNotAvailableException extends HttpException {
  constructor(gameId: number) {
    super(
      {
        message: `업적 정보 사용 불가: ${gameId}`,
        code: 'ACHIEVEMENTS_NOT_AVAILABLE',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

// user_achievementController
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { AchievementService } from './achievement.service';
import { Achievement } from '../domain/achievements/achievement.entity';

@Controller('games')
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {
    /* 공백 오류 */
  }

  @Get(':gameId/achievements')
  async getAchievements(
    @Param('gameId', ParseIntPipe) gameId: number,
  ): Promise<Achievement[]> {
    return this.achievementService.getAchievementsByGameId(gameId);
  }
}

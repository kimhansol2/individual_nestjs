// userAchievement.service.ts
import { Injectable } from '@nestjs/common';
import { AchievementRepository } from './achievement.repository';
import { Achievement } from '../domain/achievements/achievement.entity';

@Injectable()
export class AchievementService {
  constructor(private readonly achievementRepository: AchievementRepository) {
    /* 공백오류 */
  }

  async getAchievementsByGameId(gameId: number): Promise<Achievement[]> {
    return this.achievementRepository.findByGameId(gameId);
  }
}

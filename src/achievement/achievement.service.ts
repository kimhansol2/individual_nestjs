// userAchievement.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Achievement } from '../domain/achievements/achievement.entity';

@Injectable()
export class AchievementService {
  constructor(
    @InjectRepository(Achievement)
    private readonly achievementRepo: Repository<Achievement>,
  ) {
    /* 공백 오류 */
  }

  async getAchievementsByGameId(gameId: number): Promise<Achievement[]> {
    return this.achievementRepo.find({
      where: { gameId }, // FK 컬럼 직접 사용
    });
  }
}

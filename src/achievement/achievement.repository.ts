import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Achievement } from '../domain/achievements/achievement.entity';

@Injectable()
export class AchievementRepository {
  constructor(
    @InjectRepository(Achievement)
    private readonly repo: Repository<Achievement>,
  ) {
    /* 공백오류 */
  }

  async findByGameId(gameId: number): Promise<Achievement[]> {
    return this.repo.find({ where: { gameId } });
  }
}

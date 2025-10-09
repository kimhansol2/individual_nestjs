// achievements.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Achievement } from '../domain/achievements/achievement.entity';
import { AchievementService } from './achievement.service';
import { AchievementController } from './achievement.controller';
import { AchievementRepository } from './achievement.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Achievement])],
  providers: [AchievementService, AchievementRepository],
  controllers: [AchievementController],
})
export class AchievementModule {
  /* 공백 오류 */
}

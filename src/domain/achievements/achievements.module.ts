import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Achievement } from './achievement.entity';
import { UserAchievement } from './user-achievement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Achievement, UserAchievement])],
  exports: [TypeOrmModule],
})
export class AchievementsModule {}

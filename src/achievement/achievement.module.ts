// achievements.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Achievement } from '../domain/achievements/achievement.entity';
import { AchievementService } from './achievement.service';
import { AchievementController } from './achievement.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Achievement])],
    providers: [AchievementService],
    controllers: [AchievementController],
})
export class AchievementModule {
    /* 공백 오류 */
}

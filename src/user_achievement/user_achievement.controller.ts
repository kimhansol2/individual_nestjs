// user_achievementController
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  // Req, // 실사용 코드
  // UseGuards, // 실사용 코드
} from '@nestjs/common';
import { userAchievementService } from './user_achievement.service';
// import { AuthGuard } from '@nestjs/passport'; // 실사용 코드
// import express from 'express'; // 실사용 코드
import { userAchievementDto } from '../dto/userAchievement.dto'; // 테스트용

// 임의 유저ID 1사용 하드코딩
@Controller('user_achievements')
export class UserAchievementController {
  constructor(
    private readonly userAchievementService: userAchievementService,
  ) {}
  @Get('games/:gameId/achievements')
  async getUserGameAchievements(
    @Param('gameId', ParseIntPipe) gameId: number,
  ): Promise<userAchievementDto[]> {
    const userId = 1;
    return this.userAchievementService.getUserGameAchievements(userId, gameId);
  }
}

// // 실사용 코드
// @Controller('user_achievements')
// @UseGuards(AuthGuard('jwt')) // JWT 인증 적용
// export class UserAchievementController {
//   constructor(
//     private readonly userAchievementService: userAchievementService,
//   ) {}
//   @Get('games/:gameId/achievements')
//   async getUserGameAchievements(
//     @Param('gameId', ParseIntPipe) gameId: number,
//     @Req() req: express.Request,
//   ) {
//     const user = req.user as unknown as { id: number };
//     const userId = user.id; // JWT payload에서 userId 가져오기
//     return this.userAchievementService.getUserGameAchievements(userId, gameId);
//   }
// }

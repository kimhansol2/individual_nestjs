// userAchievement.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserAchievement } from '../domain/achievements/user-achievement.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { userAchievementDto } from '../dto/userAchievement.dto';
import { User } from '../domain/users/user.entity';
import { Game } from '../domain/games/game.entity';

@Injectable()
export class userAchievementService {
  constructor(
    @InjectRepository(UserAchievement)
    private readonly userAchievementRepository: Repository<UserAchievement>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
  ) {}

  async getUserGameAchievements(
    userId: number,
    gameId: number,
  ): Promise<userAchievementDto[]> {
    // 401: 토큰 누락/만료
    if (!userId) {
      throw new HttpException('토큰 누락/만료', HttpStatus.UNAUTHORIZED);
    }

    // 403: Steam 미연동
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.steamId) {
      throw new HttpException('Steam 미연동', 403);
    }

    // 404: 게임 없음
    const game = await this.gameRepository.findOne({
      where: { gameId: gameId },
    });
    if (!game) {
      throw new HttpException(
        `지원하지 않는 게임 ID: ${gameId}`,
        HttpStatus.NOT_FOUND,
      );
    }

    // 업적 조회
    const achievements = await this.userAchievementRepository.find({
      where: { userId, gameId },
      relations: ['achievement'],
    });

    // 404: 업적 시스템 없음
    if (!achievements.length) {
      throw new HttpException(
        `해당 게임 업적을 사용할 수 없습니다: ${gameId}`,
        HttpStatus.NOT_FOUND,
      );
    }

    // 정상 반환
    return achievements.map((a) => ({
      id: a.id,
      userId: a.userId,
      gameId: a.gameId,
      apiName: a.achievement.apiName,
      name: a.achievement.name,
      description: a.achievement.description,
      hidden: a.achievement.hidden,
      icon: a.achievement.icon,
      unlocked_at: a.unlockedAt,
    }));
  }
}

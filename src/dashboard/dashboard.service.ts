// 대시보드 서비스

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// 엔티티 import
import { User } from '../domain/users/user.entity';
import { Game } from '../domain/games/game.entity';
import { OwnedGame } from '../domain/games/owned-game.entity';
import { Achievement } from '../domain/achievements/achievement.entity';
import { UserAchievement } from '../domain/achievements/user-achievement.entity';
import { Friend } from '../domain/users/user-friend.entity';

// DTO import
import { DashboardResponseDto, DashboardDataDto } from './dto/dashboard-response.dto';
import { GameDto } from './dto/game.dto';
import { FriendDto } from './dto/friends.dto';
import { SummaryDto } from './dto/summary.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(OwnedGame)
    private readonly ownedGameRepo: Repository<OwnedGame>,
    @InjectRepository(Achievement)
    private readonly achievementRepo: Repository<Achievement>,
    @InjectRepository(UserAchievement)
    private readonly userAchievementRepo: Repository<UserAchievement>,
    @InjectRepository(Friend)
    private readonly friendRepo: Repository<Friend>,
  ) {}

  async getSteamDashboard(userId: number): Promise<DashboardResponseDto> {
    try {
      // 유저 정보
      const user = await this.userRepo.findOneBy({ id: userId });
      if (!user) return { data: null, error: 'User not found' };

      // 소유 게임
      const ownedGames = await this.ownedGameRepo.find({
        where: { userId },
        relations: ['game'],
      });

      // 최근 플레이 게임 (예: 최근 10개)
      const recentlyPlayed: GameDto[] = ownedGames
        .sort((a, b) => b.playtime2Weeks - a.playtime2Weeks)
        .slice(0, 10)
        .map(og => ({
          gameId: og.game.gameId,
          title: og.game.title,
          gameImage: og.game.icon || '',
          playtime_forever: og.playtimeForever,
          playtime_2weeks: og.playtime2Weeks,
          createdAt: og.createdAt.toISOString(),
          updatedAt: og.updatedAt.toISOString(),
          last_played_at: og.last_played_at.toISOString(),
        }));

      // 가장 많이 플레이한 게임
      const mostPlayedGame = ownedGames.reduce((prev, curr) =>
        prev.playtimeForever > curr.playtimeForever ? prev : curr,
      );

      const mostPlayed: GameDto = {
        gameId: mostPlayedGame.game.gameId,
        title: mostPlayedGame.game.title,
        gameImage: mostPlayedGame.game.icon || '',
        playtime_forever: mostPlayedGame.playtimeForever,
        last_played_at: mostPlayedGame.last_played_at.toISOString(),
      };

      // 성취도
      const achievements = await this.userAchievementRepo.find({ where: { userId } });
      const earned = achievements.filter(a => a.achieved).length;
      const total = achievements.length;
      const ratio = total > 0 ? (earned / total) * 100 : 0;

      // 친구 목록
      const friends = await this.friendRepo.find({ where: { userId } });
      const friendList: FriendDto[] = friends.map(f => ({
        id: f.friendId,
        steamid64: '', // 필요시 채우기
        persona_name: '', // 필요시 채우기
        avatar: '', // 필요시 채우기
      }));

      const data: DashboardDataDto = {
        profile: {
          steamid64: user.steamId,
          persona_name: user.personaName || '',
          avatar: user.avatar || '',
        },
        summary: {
          total_games: ownedGames.length,
          total_playtime_minutes: ownedGames.reduce((sum, g) => sum + g.playtimeForever, 0),
          recent_playtime_2weeks_minutes: ownedGames.reduce((sum, g) => sum + g.playtime2Weeks, 0),
          most_played_game: mostPlayed,
          last_played_at: recentlyPlayed[0]?.last_played_at || '',
        },
        recently_played: recentlyPlayed,
        achievement_progress: { earned, total, ratio },
        friends: { count: friends.length, list: friendList },
        quick_links: { games: '/games', friends: '/friends', achievements: '/achievements' },
      };

      return { data, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  }
}



// 더미데이터 임포트 - 실사용시 DB 또는 외부API 연동
// import { dummyData } from '../data/steam-dashboard';

// @Injectable()
// export class DashboardService {
//   getSteamDashboard(): DashboardResponseDto {
//     // 가장 많이 플레이한 게임
//     const mostPlayed: GameDto = {
//       gameId: dummyData.ownedGames[1].gameId,
//       title: dummyData.ownedGames[1].title,
//       gameImage: dummyData.ownedGames[1].gameImage,
//       playtime_forever: dummyData.ownedGames[1].playtime_forever,
//       last_played_at: dummyData.recentlyPlayed[1].last_played_at,
//     };

//     // 최근 플레이한 게임 목록
//     const recentlyPlayed: GameDto[] = dummyData.recentlyPlayed.map(g => ({
//       gameId: g.gameId,
//       title: g.title,
//       gameImage: g.gameImage,
//       playtime_2weeks: g.playtime_2weeks,
//       last_played_at: g.last_played_at,
//     }));

//     return {
//       data: {
//         // 프로필 정보
//         profile: dummyData.profile,
//         // 내 계정 전체 정보
//         summary: {
//           total_games: dummyData.ownedGames.length,
//           total_playtime_minutes: dummyData.ownedGames.reduce((sum, g) => sum + g.playtime_forever, 0),
//           recent_playtime_2weeks_minutes: dummyData.recentlyPlayed.reduce((sum, g) => sum + g.playtime_2weeks, 0),
//           most_played_game: mostPlayed,
//           last_played_at: recentlyPlayed[0]?.last_played_at || '',
//         },
//         // 최근 플레이 게임
//         recently_played: recentlyPlayed,
//         achievement_progress: { earned: 0, total: 0, ratio: 0 },
//         friends: { count: dummyData.friends.length, list: dummyData.friends },
//         quick_links: { games: '/games', friends: '/friends', achievements: '/achievements' },
//       },
//       error: null,
//     };
//   }
// }

// 대시보드 서비스

// src/dashboard/dashboard.service.ts

import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../domain/users/user.entity';
import { OwnedGame } from '../domain/games/owned-game.entity';
import { Game } from '../domain/games/game.entity';
import { Friend } from '../domain/friend/friend.entity';
import { AchDto } from '../dto/ach.dto';
import { oGameDto } from '../dto/oGame.dto';
import { FriendDto } from '../dto/friends.dto';
import { DashbrdDataDto } from '../dto/dashbrdData.dto';
import { DashbrdResDto } from '../dto/dashbrdRes.dto';
import { SumDto } from '../dto/sum.dto';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(OwnedGame)
    private readonly ownedGameRepository: Repository<OwnedGame>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
  ) {}

  async getSteamDashboard(userId: number): Promise<DashbrdResDto> {
    try {
      // 유저 정보
      const user: User | null = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        return { data: null, error: 'User not found' };
      }

      // 소유 게임 & 최근 플레이
      const ownedGames: OwnedGame[] = await this.ownedGameRepository.find({
        where: { userId },
        relations: ['game'],
      });

      const oGames: oGameDto[] = ownedGames.map(g => ({
        id: g.id,
        userId: g.userId,
        gameId: g.gameId,
        title: g.game.title,
        icon: g.game.icon ?? undefined,
        playtime_forever: g.playtimeForever,
        playtime_2weeks: g.playtime2Weeks,
        created_at: g.createdAt,
        updated_at: g.updatedAt,
        last_played_at: g.lastPlayedAt ?? new Date(0),
      }));

      // summary
      const mostPlayed = oGames.reduce((prev, curr) => 
        curr.playtime_forever > prev.playtime_forever ? curr : prev,
        oGames[0],
      );

      const summary: SumDto = {
        total_games: oGames.length,
        total_playtime_minutes: oGames.reduce((sum, g) => sum + g.playtime_forever, 0),
        recent_playtime_2weeks_minutes: oGames.reduce((sum, g) => sum + g.playtime_2weeks, 0),
        most_played_game: mostPlayed,
        last_played_at: oGames[0]?.last_played_at ?? new Date(0),
      };

      // 친구
      const friends: Friend[] = await this.friendRepository.find({ where: { userId } });
      const friendDtos: FriendDto[] = friends.map(f => ({
        id: f.id,
        userId: f.userId,
        friendId: f.friendId,
        friend_since: f.friend_since ?? undefined, // Date | undefined
        created_at: f.created_at,
        updated_at: f.updated_at,
      }));

      // dashboard data
      const data: DashbrdDataDto = {
        profile: {
          steamid: user.steamId,
          personaName: user.personaName ?? '',
          avatar: user.avatar ?? undefined,
        },
        summary,
        recently_played: oGames,
        achievement_progress: { earned: 0, total: 0, ratio: 0 },
        friends: { count: friendDtos.length, list: friendDtos },
        quick_links: { games: '/games', friends: '/friends', achievements: '/achievements' },
      };

      return { data, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
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

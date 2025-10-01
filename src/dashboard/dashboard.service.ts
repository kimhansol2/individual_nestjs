// dashboardService

import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../domain/users/user.entity';
import { OwnedGame } from '../domain/games/owned-game.entity';
import { Game } from '../domain/games/game.entity';
import { Friend } from '../domain/friend/friend.entity';
import { ownedGameDto } from '../dto/ownedGame.dto';
import { FriendDto } from '../dto/friends.dto';
import { DashboardDataDto } from '../dto/dashboardData.dto';
import { DashboardResponseDto } from '../dto/dashboardResponse.dto';
import { SummaryDto } from '../dto/summary.dto';
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

  async getSteamDashboard(userId: number): Promise<DashboardResponseDto> {
    try {
      // 유저 정보
      const user = await this.userRepository.findOneBy({ id: userId });
      if (!user) {
        // userId가 없거나 만료된 경우
        throw new UnauthorizedException('User session expired or not found');
      }

      // 소유 게임 & 최근 플레이
      const ownedGames: OwnedGame[] = await this.ownedGameRepository.find({
        where: {
          userId,
        },
        relations: ['game'],
      });

      const oGames: ownedGameDto[] = ownedGames.map((g) => ({
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
      const mostPlayed = oGames.reduce(
        (prev, curr) =>
          curr.playtime_forever > prev.playtime_forever ? curr : prev,
        oGames[0],
      );

      const summary: SummaryDto = {
        total_games: oGames.length,
        total_playtime_minutes: oGames.reduce(
          (sum, g) => sum + g.playtime_forever,
          0,
        ),
        recent_playtime_2weeks_minutes: oGames.reduce(
          (sum, g) => sum + g.playtime_2weeks,
          0,
        ),
        most_played_game: mostPlayed,
        last_played_at: oGames[0]?.last_played_at ?? new Date(0),
      };

      // 친구
      const friends: Friend[] = await this.friendRepository.find({
        where: { userId },
      });
      const friendDtos: FriendDto[] = friends.map((f) => ({
        id: f.id,
        userId: f.userId,
        friendId: f.friendId,
        friend_since: f.friend_since ?? undefined, // Date | undefined
        created_at: f.created_at,
        updated_at: f.updated_at,
      }));

      // dashboard data
      const data: DashboardDataDto = {
        profile: {
          steamid: user.steamId,
          personaName: user.personaName ?? '',
          avatar: user.avatar ?? undefined,
        },
        summary,
        recently_played: oGames,
        achievement_progress: {
          earned: 0,
          total: 0,
          ratio: 0,
        },
        friends: {
          count: friendDtos.length,
          list: friendDtos,
        },
        quick_links: {
          games: '/games',
          friends: '/friends',
          achievements: '/achievements',
        },
      };

      return { data, error: null };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        // 401 예외는 그대로 던짐
        throw err;
      }
      // 그 외 예외는 500 처리
      console.error('DashboardService error:', err);
      throw new InternalServerErrorException('Failed to load dashboard');
    }
  }
}

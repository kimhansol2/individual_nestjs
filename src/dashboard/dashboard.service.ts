// 대시보드 서비스

import { Injectable } from '@nestjs/common';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { GameDto } from './dto/game.dto';

// 더미데이터 임포트 - 실사용시 DB 또는 외부API 연동
import { dummyData } from '../data/steam-dashboard';

@Injectable()
export class DashboardService {
  getSteamDashboard(): DashboardResponseDto {
    // 가장 많이 플레이한 게임
    const mostPlayed: GameDto = {
      gameId: dummyData.ownedGames[1].gameId,
      title: dummyData.ownedGames[1].title,
      gameImage: dummyData.ownedGames[1].gameImage,
      playtime_forever: dummyData.ownedGames[1].playtime_forever,
      last_played_at: dummyData.recentlyPlayed[1].last_played_at,
    };

    // 최근 플레이한 게임 목록
    const recentlyPlayed: GameDto[] = dummyData.recentlyPlayed.map(g => ({
      gameId: g.gameId,
      title: g.title,
      gameImage: g.gameImage,
      playtime_2weeks: g.playtime_2weeks,
      last_played_at: g.last_played_at,
    }));

    return {
      data: {
        // 프로필 정보
        profile: dummyData.profile,
        // 내 계정 전체 정보
        summary: {
          total_games: dummyData.ownedGames.length,
          total_playtime_minutes: dummyData.ownedGames.reduce((sum, g) => sum + g.playtime_forever, 0),
          recent_playtime_2weeks_minutes: dummyData.recentlyPlayed.reduce((sum, g) => sum + g.playtime_2weeks, 0),
          most_played_game: mostPlayed,
          last_played_at: recentlyPlayed[0]?.last_played_at || '',
        },
        // 최근 플레이 게임
        recently_played: recentlyPlayed,
        achievement_progress: { earned: 0, total: 0, ratio: 0 },
        friends: { count: dummyData.friends.length, list: dummyData.friends },
        quick_links: { games: '/games', friends: '/friends', achievements: '/achievements' },
      },
      error: null,
    };
  }
}

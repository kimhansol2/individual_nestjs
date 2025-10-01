// 더미데이터 타입 정의
// steam-dashboard <- 더미데이터 값 정의
// dashboard-response.dto <- 더미데이터 타입,구조 정의

import { GameDto } from './game.dto';
import { FriendDto } from './friends.dto';
import { SummaryDto } from './summary.dto';

// 대시보드 데이터 구조 정의
export class DashboardDataDto {
  profile: {
    steamid64: string;
    persona_name: string;
    avatar: string;
  };
  summary: SummaryDto;
  recently_played: GameDto[];
  achievement_progress: { earned: number; total: number; ratio: number };
  friends: { count: number; list?: FriendDto[] };
  quick_links: { games: string; friends: string; achievements: string };
}

// 대시보드 응답 구조 정의
export class DashboardResponseDto {
  data: DashboardDataDto | null;
  error: string | null;
}

// 전체 정보 요약

import { GameDto } from './game.dto';

export class SummaryDto {
  total_games: number;
  total_playtime_minutes: number;
  recent_playtime_2weeks_minutes: number;
  most_played_game: GameDto;
  last_played_at: string;
}

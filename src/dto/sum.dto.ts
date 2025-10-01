// summaryDTO

import { oGameDto } from './oGame.dto';

export class SumDto {
  total_games!: number;
  total_playtime_minutes!: number;
  recent_playtime_2weeks_minutes!: number;
  most_played_game!: oGameDto;
  last_played_at!: Date;
}

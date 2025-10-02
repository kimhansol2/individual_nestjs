// achievementDTO

import { GameDto } from './game.dto';
type GameIdMapped = { gameId: GameDto['gameId'] };
export class AchievementDto implements GameIdMapped {
  id!: number;
  gameId!: number;
  apiName!: string;
  name!: string;
  description?: string;
  hidden!: boolean;
  icon?: string;
  created_at?: Date;
  updated_at?: Date;
}

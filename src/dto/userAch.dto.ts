// userAchievementDTO

import { UserDto } from './user.dto';
import { AchDto } from './ach.dto';

type UserIdMapped = { userId: UserDto['id'] };
type AchGameIdMapped = { gameId: AchDto['gameId'] };
type AchApiNameMapped = { apiName: AchDto['apiName'] };

export class userAchDto implements AchApiNameMapped, AchGameIdMapped, UserIdMapped  {
  id!: number;
  userId!: number;
  gameId!: number;
  apiName!: string;
  name!: string;
  description?: string;
  hidden!: boolean;
  icon?: string;
  created_at?: Date;
  updated_at?: Date;
}
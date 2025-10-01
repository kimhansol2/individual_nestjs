// dashboardDataDTO

import { SumDto } from './sum.dto';
import { oGameDto } from './oGame.dto';
import { FriendDto } from './friends.dto';

export class DashbrdDataDto {
  profile!: {
    steamid: string;
    personaName: string;
    avatar?: string;
  };
  summary!: SumDto;
  recently_played!: oGameDto[];
  achievement_progress!: {
    earned: number;
    total: number;
    ratio: number;
  };
  friends!: {
    count: number;
    list?: FriendDto[];
  };
  quick_links!: {
    games: string;
    friends: string;
    achievements: string;
  };
}
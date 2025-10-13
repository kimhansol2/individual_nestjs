// dashboardModule

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { User } from '../domain/users/user.entity';
import { OwnedGame } from '../domain/games/owned-game.entity';
import { Game } from '../domain/games/game.entity';
import { Friend } from '../domain/friends/friends.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, OwnedGame, Game, Friend])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {
  /* 공백오류 */
}

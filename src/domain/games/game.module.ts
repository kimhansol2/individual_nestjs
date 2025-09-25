import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './game.entity';
import { OwnedGame } from './owned-game.entity';
import { OwnedGameRepository } from './owned-game.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Game, OwnedGame])],
  providers: [OwnedGameRepository],
  exports: [OwnedGameRepository],
})
export class GameDomainModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './game.entity';
import { OwnedGame } from './owned-game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Game, OwnedGame])],
  exports: [TypeOrmModule],
})
export class GameDomainModule {}

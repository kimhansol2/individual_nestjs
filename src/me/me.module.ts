import { Module } from '@nestjs/common';
import { CacheAsideModule } from 'src/common/cache/cache-aside.module';
import { GameDomainModule } from 'src/domain/games/game.module';
import { UsersModule } from 'src/domain/users/users.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    UsersModule,
    GameDomainModule,
    CacheAsideModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: 60,
        },
      ],
    }),
  ],
  controllers: [MeController],
  providers: [MeService],
  exports: [MeService],
})
export class MeModule {}

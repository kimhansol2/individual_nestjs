import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from 'src/domain/users/users.module';
import { RedisModule } from 'src/infra/redis/redis.module';
import { SteamAuthController } from './auth.controller';
import { SteamOpenIdService } from './steam-openid.service';
import { JwtAccessStrategy } from './jwt-access.strategy';
import { MeModule } from 'src/me/me.module';
import { GameDomainModule } from 'src/domain/games/game.module';

@Module({
  imports: [
    UsersModule,
    RedisModule,
    JwtModule.register({}),
    MeModule,
    GameDomainModule,
  ],
  controllers: [SteamAuthController],
  providers: [SteamOpenIdService, JwtAccessStrategy],
  exports: [SteamOpenIdService],
})
export class AuthModule {}

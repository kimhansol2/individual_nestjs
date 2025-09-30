import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from 'src/domain/users/users.module';
import { RedisModule } from 'src/infra/redis/redis.module';
import { SteamAuthController } from './auth.controller';
import { SteamOpenIdService } from './steam-openid.service';

@Module({
  imports: [UsersModule, RedisModule, JwtModule.register({})],
  controllers: [SteamAuthController],
  providers: [SteamOpenIdService],
  exports: [SteamOpenIdService],
})
export class AuthModule {}

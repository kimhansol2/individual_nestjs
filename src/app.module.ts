import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SteamModule } from './integrations/steam/steam.module';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';
import { GameModule } from './game/game.module';
import { FriendsModule } from './friends/friends.module';
import { UsersModule } from './domain/users/users.module';
import { GameDomainModule } from './domain/game/game.module';
import { AchievementsModule } from './domain/achievements/achievements.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('dev', 'prod', 'test').default('dev'),
        PORT: Joi.number().default(3000),
        STEAM_API_KEY: Joi.string().required(),
        STEAM_REALM: Joi.string().uri().required(),
        STEAM_RETURN_URL: Joi.string().uri().required(),
      }),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        username: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        autoLoadEntities: true,
        synchronize: true, // prod에서 false 변경 예정
      }),
    }),
    SteamModule,
    AuthModule,
    MeModule,
    GameModule,
    FriendsModule,
    UsersModule,
    AchievementsModule,
    GameDomainModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

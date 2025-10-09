import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SteamModule } from './integrations/steam/steam.module';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';
import { UsersModule } from './domain/users/users.module';
import { GameDomainModule } from './domain/games/game.module';
import { AchievementsModule } from './domain/achievements/achievements.module';
import { OwnedGame } from './domain/games/owned-game.entity';
import { Game } from './domain/games/game.entity';
import { User } from './domain/users/user.entity';
import { Achievement } from './domain/achievements/achievement.entity';
import { UserAchievement } from './domain/achievements/user-achievement.entity';
import { RedisModule } from './infra/redis/redis.module';
import { HealthController } from './infra/redis/redis-health.controller';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { CacheAsideModule } from './common/cache/cache-aside.module';
import { FriendsModule } from './domain/friends/friends.module';
import { AuthController } from './auth/auth.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('dev', 'prod', 'test').default('dev'),
        PORT: Joi.number().default(3000),
        STEAM_API_KEY: Joi.string().required(),
        STEAM_REALM: Joi.string().uri().required(),
        STEAM_RETURN_TO: Joi.string().uri().required(),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('15m'),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('3d'),
        REDIS_URL: Joi.string().required(),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60초
        limit: 10, // 60초당 10개 요청
      },
    ]),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        username: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        autoLoadEntities: true,
        synchronize: true,
        logging: process.env.TYPEORM_LOGGING === 'true',
        migrations: ['dist/migrations/*.js'],
        migrationsTransactionMode: 'each',

        entities: [OwnedGame, Game, User, Achievement, UserAchievement],
      }),
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          url: process.env.REDIS_URL,
        }),
        ttl: 30,
        max: 0,
      }),
    }),
    SteamModule,
    AuthModule,
    MeModule,
    UsersModule,
    AchievementsModule,
    GameDomainModule,
    RedisModule,
    CacheAsideModule,
    FriendsModule,
  ],
  controllers: [AppController, HealthController, AuthController],
  providers: [AppService],
})
export class AppModule {}

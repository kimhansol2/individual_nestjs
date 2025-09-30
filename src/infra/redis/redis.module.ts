import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisHealthService } from './redis-health.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS',
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const url = cfg.getOrThrow<string>('REDIS_URL');
        const u = new URL(url);
        const client = new Redis(url, {
          maxRetriesPerRequest: 1,
        });

        console.log(
          '[Redis] using URL',
          `${u.protocol}//${u.username}@${u.hostname}:${u.port}`,
        );
        client.on('connect', () => console.log('[Redis] connecting...'));
        client.on('ready', () => console.log('[Redis] ready'));
        client.on('error', (e) => console.error('[Redis]', e.message));
        return client;
      },
    },
    RedisHealthService,
  ],
  exports: ['REDIS', RedisHealthService],
})
export class RedisModule {}

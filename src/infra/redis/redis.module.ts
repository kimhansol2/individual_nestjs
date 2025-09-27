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
        const host = cfg.getOrThrow<string>('REDIS_HOST');
        const port = Number(cfg.getOrThrow<string>('REDIS_PORT'));
        const username = cfg.getOrThrow<string>('REDIS_USERNAME');
        const password = cfg.getOrThrow<string>('REDIS_PASSWORD');

        const client = new Redis({
          host,
          port,
          username,
          password,
          tls: { servername: host, minVersion: 'TLSv1.2' },
          maxRetriesPerRequest: 1,
        });

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

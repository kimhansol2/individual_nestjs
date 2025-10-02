import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from './redis.constants';

@Injectable()
export class RedisHealthService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}
  async ping() {
    return this.redis.ping();
  }
}

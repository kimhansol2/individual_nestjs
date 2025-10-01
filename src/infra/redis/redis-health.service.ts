import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthService {
  constructor(@Inject('REDIS') private readonly redis: Redis) {}
  async ping() {
    return this.redis.ping();
  }
}

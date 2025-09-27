import { Controller, Get } from '@nestjs/common';
import { RedisHealthService } from './redis-health.service';

@Controller('health')
export class HealthControllerr {
  constructor(private readonly redisHealth: RedisHealthService) {}
  @Get('redis')
  async redis() {
    const pong = await this.redisHealth.ping();
    return { status: 'ok', pong };
  }
}

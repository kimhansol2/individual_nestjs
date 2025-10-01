import { Controller, Get } from '@nestjs/common';
import { RedisHealthService } from './redis-health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly redisHealth: RedisHealthService) {}

  @Get('redis')
  async redis() {
    const t0 = Date.now();
    const pong = await this.redisHealth.ping();
    return { ok: pong === 'PONG', pong, latencyMs: Date.now() - t0 };
  }
}

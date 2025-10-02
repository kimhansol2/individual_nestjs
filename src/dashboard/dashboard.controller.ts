// dashboard.controller.ts

import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardResponseDto } from '../dto/dashboardResponse.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {
    /* 공백오류 */
  }

  // GET /dashboard 요청
  @Get()
  async getDashboard(): Promise<DashboardResponseDto> {
    const userId = 1; // 테스트용 userId, 실제 인증된 유저 ID로 변경 필요
    return await this.dashboardService.getSteamDashboard(userId);
  }
}

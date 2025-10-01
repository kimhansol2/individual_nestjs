// 대시보드 컨트롤러

import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // GET/dashboard 요청
  @Get()
  getDashboard(): DashboardResponseDto {
    return this.dashboardService.getSteamDashboard();
  }
}

// dashboardResponseDTO

import { DashboardDataDto } from './dashboardData.dto';

export class DashboardResponseDto {
  data: DashboardDataDto | null = null;
  error: string | null = null;
}

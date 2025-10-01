// dashboardResponseDTO

import { DashbrdDataDto } from './dashbrdData.dto';

export class DashbrdResDto {
  data: DashbrdDataDto | null = null;
  error: string | null = null;
}
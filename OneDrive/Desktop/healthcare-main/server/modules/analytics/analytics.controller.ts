import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('facility/:facilityId/dashboard')
  async getFacilityDashboard(@Param('facilityId') facilityId: string) {
    return this.analyticsService.getFacilityDashboard(parseInt(facilityId, 10));
  }

  @Get('facility/:facilityId/wait-times')
  async getWaitTimes(
    @Param('facilityId') facilityId: string,
    @Query('hours') hours: string = '24',
  ) {
    return this.analyticsService.getWaitTimes(parseInt(facilityId, 10), parseInt(hours, 10));
  }

  @Get('health')
  async healthCheck() {
    return this.analyticsService.pythonServiceHealthCheck();
  }
}

import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { BedService } from './bed.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/beds')
@UseGuards(JwtAuthGuard)
export class BedController {
  constructor(private readonly bedService: BedService) {}

  @Get('facility/:facilityId/units')
  async getUnitsForFacility(@Param('facilityId') facilityId: string) {
    return this.bedService.getUnitsForFacility(parseInt(facilityId, 10));
  }

  @Get('unit/:unitId/beds')
  async getBedsForUnit(@Param('unitId') unitId: string) {
    return this.bedService.getBedsForUnit(parseInt(unitId, 10));
  }

  @Get('facility/:facilityId/available-count')
  async getAvailableBedCount(@Param('facilityId') facilityId: string) {
    return {
      facilityId: parseInt(facilityId, 10),
      availableBeds: await this.bedService.getAvailableBedCount(parseInt(facilityId, 10)),
    };
  }

  @Post('facility/:facilityId/units')
  async createUnit(
    @Param('facilityId') facilityId: string,
    @Body() data: { name: string; totalBeds: number; description?: string },
  ) {
    return this.bedService.createUnit(parseInt(facilityId, 10), data);
  }

  @Put('bed/:bedId/status')
  async updateBedStatus(
    @Param('bedId') bedId: string,
    @Body() data: { status: string; patientId?: string },
  ) {
    return this.bedService.updateBedStatus(parseInt(bedId, 10), data.status, data.patientId);
  }

  @Get('nearby-facilities')
  async getNearbyFacilitiesWithBeds(
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('radius') radius: string = '10',
  ) {
    return this.bedService.getNearbyFacilitiesWithBeds(latitude, longitude, parseInt(radius, 10));
  }
}

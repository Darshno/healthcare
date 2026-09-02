import { Controller, Get, Post, Body, Param, UseGuards } from "@nestjs/common";
import { BedsService } from "./beds.service";

@Controller("beds")
export class BedsController {
  constructor(private readonly bedsService: BedsService) {}

  /**
   * Get all beds and units for a hospital
   */
  @Get("hospital/:hospitalId")
  async getBedsByHospital(@Param("hospitalId") hospitalId: string) {
    return await this.bedsService.getBedsByHospital(hospitalId);
  }

  /**
   * Get statistics for a specific unit
   */
  @Get("unit/:unitId/stats")
  async getUnitStats(@Param("unitId") unitId: string) {
    return await this.bedsService.getUnitStats(unitId);
  }

  /**
   * Get available beds in a unit
   */
  @Get("unit/:unitId/available")
  async getAvailableBeds(@Param("unitId") unitId: string) {
    return await this.bedsService.getAvailableBeds(unitId);
  }

  /**
   * Update bed status
   */
  @Post(":bedId/status")
  async updateBedStatus(
    @Param("bedId") bedId: string,
    @Body() body: { status: "available" | "occupied" | "maintenance"; occupiedByPatientId?: string },
  ) {
    return await this.bedsService.updateBedStatus(bedId, body.status, body.occupiedByPatientId);
  }

  /**
   * Get occupancy history for a bed
   */
  @Get(":bedId/history")
  async getBedOccupancyHistory(@Param("bedId") bedId: string) {
    return await this.bedsService.getBedOccupancyHistory(bedId);
  }

  /**
   * Find nearby hospitals with available beds
   */
  @Post("nearby/available")
  async getNearbyHospitals(@Body() body: { latitude: number; longitude: number; radiusKm?: number }) {
    return await this.bedsService.getNearbyHospitalsWithAvailableBeds(body.latitude, body.longitude, body.radiusKm);
  }
}

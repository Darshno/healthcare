import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { BedService } from "./modules/bed/bed.service";

const bedService = new BedService();

export const bedRouter = router({
  unitsForFacility: protectedProcedure
    .input(z.object({
      facilityId: z.number().int().positive(),
    }))
    .query(async ({ input }) => {
      return bedService.getUnitsForFacility(input.facilityId);
    }),

  bedsForUnit: protectedProcedure
    .input(z.object({
      unitId: z.number().int().positive(),
    }))
    .query(async ({ input }) => {
      return bedService.getBedsForUnit(input.unitId);
    }),

  availableBedCount: protectedProcedure
    .input(z.object({
      facilityId: z.number().int().positive(),
    }))
    .query(async ({ input }) => {
      const count = await bedService.getAvailableBedCount(input.facilityId);
      return { facilityId: input.facilityId, availableBeds: count };
    }),

  createUnit: protectedProcedure
    .input(z.object({
      facilityId: z.number().int().positive(),
      name: z.string().min(1).max(255),
      totalBeds: z.number().int().positive(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return bedService.createUnit(input.facilityId, {
        name: input.name,
        totalBeds: input.totalBeds,
        description: input.description,
      });
    }),

  updateBedStatus: protectedProcedure
    .input(z.object({
      bedId: z.number().int().positive(),
      status: z.enum(["available", "occupied", "maintenance", "reserved"]),
      patientId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return bedService.updateBedStatus(input.bedId, input.status, input.patientId);
    }),

  nearbyFacilitiesWithBeds: protectedProcedure
    .input(z.object({
      latitude: z.string(),
      longitude: z.string(),
      radiusKm: z.number().positive().default(10),
    }))
    .query(async ({ input }) => {
      return bedService.getNearbyFacilitiesWithBeds(input.latitude, input.longitude, input.radiusKm);
    }),

  updateUnitOccupancy: protectedProcedure
    .input(z.object({
      facilityId: z.number().int().positive(),
    }))
    .mutation(async ({ input }) => {
      return bedService.updateUnitOccupancy(input.facilityId);
    }),
});

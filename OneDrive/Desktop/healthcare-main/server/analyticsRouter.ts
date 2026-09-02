import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { AnalyticsService } from "./modules/analytics/analytics.service";

const analyticsService = new AnalyticsService();

export const analyticsRouter = router({
  facilityDashboard: protectedProcedure
    .input(z.object({
      facilityId: z.number().int().positive(),
    }))
    .query(async ({ input }) => {
      return analyticsService.getFacilityDashboard(input.facilityId);
    }),

  waitTimes: protectedProcedure
    .input(z.object({
      facilityId: z.number().int().positive(),
      hours: z.number().int().positive().default(24).optional(),
    }))
    .query(async ({ input }) => {
      return analyticsService.getWaitTimes(input.facilityId, input.hours || 24);
    }),

  dailyReport: protectedProcedure
    .input(z.object({
      facilityId: z.number().int().positive(),
      date: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return analyticsService.getDailyReport(input.facilityId, input.date);
    }),

  weeklyReport: protectedProcedure
    .input(z.object({
      facilityId: z.number().int().positive(),
    }))
    .query(async ({ input }) => {
      return analyticsService.getWeeklyReport(input.facilityId);
    }),

  monthlyReport: protectedProcedure
    .input(z.object({
      facilityId: z.number().int().positive(),
    }))
    .query(async ({ input }) => {
      return analyticsService.getMonthlyReport(input.facilityId);
    }),

  pythonServiceHealth: protectedProcedure
    .query(async () => {
      return analyticsService.pythonServiceHealthCheck();
    }),
});

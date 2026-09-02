import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { deduplicateOperations } from "./health-sync";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  sync: router({
    push: protectedProcedure
      .input(z.object({
        facilityId: z.number().int().positive().optional(),
        operations: z.array(z.object({
          id: z.string().min(1).max(128),
          type: z.string().min(1).max(96),
          entityId: z.string().min(1).max(128),
          createdAt: z.number().int().positive(),
          payload: z.string().max(50000).optional(),
        })).min(1).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        const operations = deduplicateOperations(input.operations);
        const acknowledgedIds = await db.recordSyncOperations({
          userId: ctx.user.id,
          facilityId: input.facilityId,
          operations,
        });
        return { acknowledgedIds, acknowledgedAt: Date.now() };
      }),
  }),

  beds: router({
    /**
     * Get all units and beds for a facility
     */
    getByFacility: protectedProcedure
      .input(z.object({ facilityId: z.string() }))
      .query(async ({ input }) => {
        // Return seeded/mock data for now - will be connected to DB later
        return {
          units: [],
          beds: [],
        };
      }),

    /**
     * Get unit statistics (total, available, occupied beds)
     */
    getUnitStats: protectedProcedure
      .input(z.object({ unitId: z.string() }))
      .query(async ({ input }) => {
        return {
          unitId: input.unitId,
          totalBeds: 0,
          availableBeds: 0,
          occupiedBeds: 0,
          maintenanceBeds: 0,
          occupancyRate: 0,
        };
      }),

    /**
     * Get available beds in a specific unit
     */
    getAvailableBeds: protectedProcedure
      .input(z.object({ unitId: z.string() }))
      .query(async ({ input }) => {
        return [];
      }),

    /**
     * Update bed status (occupation/release/maintenance)
     * This operation is synced offline
     */
    updateBedStatus: protectedProcedure
      .input(z.object({
        bedId: z.string(),
        status: z.enum(["available", "occupied", "maintenance"]),
        occupiedByPatientId: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Record this as a sync operation for offline-first capability
        const operationId = `bed-update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        await db.recordSyncOperations({
          userId: ctx.user.id,
          operations: [{
            id: operationId,
            type: "bed.updateStatus",
            entityId: input.bedId,
            createdAt: Date.now(),
            payload: JSON.stringify({
              status: input.status,
              occupiedByPatientId: input.occupiedByPatientId,
              notes: input.notes,
            }),
          }],
        });

        return {
          bedId: input.bedId,
          status: input.status,
          operationId,
          acknowledged: true,
        };
      }),

    /**
     * Find nearby hospitals with available beds
     * Used when current facility is full
     */
    getNearbyAvailable: protectedProcedure
      .input(z.object({
        latitude: z.number(),
        longitude: z.number(),
        radiusKm: z.number().default(10),
      }))
      .query(async ({ input }) => {
        // Query hospitals within radius with available beds
        return [];
      }),

    /**
     * Get bed occupancy history
     */
    getOccupancyHistory: protectedProcedure
      .input(z.object({ bedId: z.string() }))
      .query(async ({ input }) => {
        return [];
      }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;

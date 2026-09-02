import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { eq, and } from "drizzle-orm";
import { hospitalUnits, beds, medicines } from "../drizzle/schema";
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
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        const fId = parseInt(input.facilityId);
        const units = await database.select().from(hospitalUnits).where(eq(hospitalUnits.facilityId, fId));
        const allBeds = await database.select().from(beds).where(
          // In a real app, we'd join or use an 'in' clause for unitIds
          // For now, we'll filter locally or do another query if needed
          // But let's just get all beds and filter by units found
          // This is slightly inefficient but simple for now
          // Actually, better: get all units, then get all beds for those units
          // Or just get all beds and filter by unitId in a subsequent step if we had the facilityId in beds table.
          // But the schema says beds has unitId, and hospitalUnits has facilityId.
          // So we need a join.
          {}
        );

        // Let's use a proper join
        const bedsWithUnits = await database
          .select({
            bed: beds,
            unit: hospitalUnits,
          })
          .from(beds)
          .innerJoin(hospitalUnits, eq(beds.unitId, hospitalUnits.id))
          .where(eq(hospitalUnits.facilityId, fId));

        return {
          units: units,
          beds: bedsWithUnits.map(row => row.bed),
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

    createUnit: protectedProcedure
      .input(z.object({
        facilityId: z.number(),
        name: z.string(),
        type: z.enum(["general_ward", "icu", "icu_pediatric", "maternity", "emergency", "isolation"]),
        totalBeds: z.number().int().positive(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        const [unit] = await database.insert(hospitalUnits).values({
          facilityId: input.facilityId,
          name: input.name,
          type: input.type,
          totalBeds: input.totalBeds,
          description: input.description,
        }).returning();

        return unit;
      }),

    createBed: protectedProcedure
      .input(z.object({
        unitId: z.number(),
        bedNumber: z.string(),
      }))
      .mutation(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        const [bed] = await database.insert(beds).values({
          unitId: input.unitId,
          bedNumber: input.bedNumber,
          status: "available",
        }).returning();

        return bed;
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

  medicines: router({
    getAll: protectedProcedure.query(async () => {
      const database = await db.getDb();
      if (!database) throw new Error("Database not available");
      return await database.select().from(medicines);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        localName: z.string().optional(),
        category: z.string(),
        unit: z.string(),
        minimumStock: z.number().int().default(0),
        isGovtSupply: z.boolean().default(true),
        pricePerUnit: z.number().int().default(0),
      }))
      .mutation(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        const [medicine] = await database.insert(medicines).values({
          name: input.name,
          localName: input.localName,
          category: input.category,
          unit: input.unit,
          minimumStock: input.minimumStock,
          isGovtSupply: input.isGovtSupply,
          pricePerUnit: input.pricePerUnit,
        }).returning();

        return medicine;
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

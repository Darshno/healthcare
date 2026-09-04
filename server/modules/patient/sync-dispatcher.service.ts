/**
 * SyncDispatcherService
 *
 * Receives an offline operation from the client and replays it against the
 * appropriate domain service.  Each handler is responsible for idempotency:
 * the dispatcher guarantees that duplicate operationIds are never executed
 * twice (checked before this service is called by SyncService).
 *
 * Supported operation types:
 *   patient.create        – create / upsert a patient record
 *   patient.update        – update an existing patient
 *   queue.add             – add patient to priority queue
 *   queue.status          – update queue entry status
 *   queue.override        – clinician overrides queue priority
 *   encounter.create      – record a consultation encounter
 *   referral.create       – create a referral
 *   referral.status       – update referral status
 *   inventory.receipt     – restock medicine
 *   inventory.dispense    – dispense medicine
 *   inventory.adjustment  – adjust medicine stock
 *   bed.occupy            – mark bed as occupied
 *   bed.release           – release a bed
 *   bed.maintenance       – put bed in maintenance
 *   medicine.create       – add a new medicine record
 */
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Patient } from "../../database/entities/patient.entity";
import { QueueEntry } from "../../database/entities/queue-entry.entity";
import { TriageResult } from "../../database/entities/triage-result.entity";
import { Bed } from "../../database/entities/bed.entity";
import { BedOccupancy } from "../../database/entities/bed-occupancy.entity";
import { Medicine } from "../../database/entities/medicine.entity";
import { InventoryTransaction } from "../../database/entities/inventory-transaction.entity";


export interface DispatchInput {
  operationType: string;
  entityId: string;
  payload: string | null;
  userId: number;
  hospitalId?: number | null;
}

export interface DispatchResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  serverEntityId?: number;
}

@Injectable()
export class SyncDispatcherService {
  private readonly logger = new Logger(SyncDispatcherService.name);

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(QueueEntry)
    private readonly queueRepo: Repository<QueueEntry>,
    @InjectRepository(TriageResult)
    private readonly triageRepo: Repository<TriageResult>,
    @InjectRepository(Bed)
    private readonly bedRepo: Repository<Bed>,
    @InjectRepository(BedOccupancy)
    private readonly bedOccupancyRepo: Repository<BedOccupancy>,
    @InjectRepository(Medicine)
    private readonly medicineRepo: Repository<Medicine>,
    @InjectRepository(InventoryTransaction)
    private readonly inventoryRepo: Repository<InventoryTransaction>,
  ) {}

  async dispatch(input: DispatchInput): Promise<DispatchResult> {
    const payload = input.payload ? this.parsePayload(input.payload) : null;

    try {
      switch (input.operationType) {
        case "patient.create":
          return await this.handlePatientCreate(input.entityId, payload, input.hospitalId);
        case "patient.update":
          return await this.handlePatientUpdate(input.entityId, payload, input.hospitalId);
        case "queue.add":
          return await this.handleQueueAdd(input.entityId, payload, input.hospitalId);
        case "queue.status":
          return await this.handleQueueStatus(input.entityId, payload);
        case "queue.override":
          return await this.handleQueueOverride(input.entityId, payload);
        case "encounter.create":
          return await this.handleEncounterCreate(input.entityId, payload, input.hospitalId);
        case "referral.create":
          return await this.handleReferralCreate(input.entityId, payload, input.hospitalId);
        case "referral.status":
          return await this.handleReferralStatus(input.entityId, payload);
        case "inventory.receipt":
        case "inventory.dispense":
        case "inventory.adjustment":
        case "inventory.wastage":
        case "inventory.expiry":
          return await this.handleInventoryTransaction(input.operationType, input.entityId, payload, input.userId);
        case "bed.occupy":
          return await this.handleBedOccupy(input.entityId, payload, input.userId);
        case "bed.release":
          return await this.handleBedRelease(input.entityId, payload, input.userId);
        case "bed.maintenance":
          return await this.handleBedMaintenance(input.entityId, payload);
        case "medicine.create":
          return await this.handleMedicineCreate(input.entityId, payload);
        default:
          this.logger.warn(`Unknown operation type: ${input.operationType} (entityId=${input.entityId})`);
          return { success: true, skipped: true, reason: `Unhandled type: ${input.operationType}` };
      }
    } catch (error) {
      this.logger.error(`Failed to dispatch ${input.operationType} for ${input.entityId}:`, error);
      return { success: false, reason: error instanceof Error ? error.message : "Dispatch error" };
    }
  }

  // ─── Patient ─────────────────────────────────────────────────────────────────

  private async handlePatientCreate(
    localId: string,
    payload: Record<string, unknown> | null,
    hospitalId?: number | null,
  ): Promise<DispatchResult> {
    if (!payload) return { success: true, skipped: true, reason: "No payload for patient.create" };

    // Idempotency: find by localId
    const existing = await this.patientRepo.findOne({ where: { localId } });
    if (existing) {
      return { success: true, skipped: true, reason: "Patient already exists", serverEntityId: existing.id };
    }

    const patient = this.patientRepo.create({
      localId,
      name: (payload.name as string) || "Unknown",
      dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth as string) : null,
      gender: (payload.sex as string) || null,
      hospitalId: hospitalId ?? 1,
      guardianName: (payload.guardianName as string) || null,
      contactPhone: (payload.contact as string) || null,
      careCategory: (payload.careCategory as any) || this.mapPriority(payload.priority as string),
      allergies: Array.isArray(payload.allergies) ? (payload.allergies as string[]).join(", ") : null,
      currentMedicines: Array.isArray(payload.currentMedicines) ? (payload.currentMedicines as string[]).join(", ") : null,
    });

    const saved = await this.patientRepo.save(patient);
    return { success: true, serverEntityId: saved.id };
  }

  private async handlePatientUpdate(
    localId: string,
    payload: Record<string, unknown> | null,
    hospitalId?: number | null,
  ): Promise<DispatchResult> {
    if (!payload) return { success: true, skipped: true, reason: "No payload for patient.update" };

    const patient = await this.patientRepo.findOne({ where: { localId } });
    if (!patient) {
      // Create if not found (sync may arrive out of order)
      return this.handlePatientCreate(localId, payload, hospitalId);
    }

    await this.patientRepo.update(patient.id, {
      name: (payload.name as string) || patient.name,
      careCategory: (payload.careCategory as any) || (this.mapPriority(payload.priority as string) as any) || patient.careCategory,
      allergies: Array.isArray(payload.allergies) ? (payload.allergies as string[]).join(", ") : patient.allergies,
    });

    return { success: true, serverEntityId: patient.id };
  }

  // ─── Queue ────────────────────────────────────────────────────────────────────

  private async handleQueueAdd(
    localQueueId: string,
    payload: Record<string, unknown> | null,
    hospitalId?: number | null,
  ): Promise<DispatchResult> {
    if (!payload) return { success: true, skipped: true, reason: "No payload for queue.add" };

    // Find the server-side patient by localId
    const localPatientId = payload.patientId as string;
    const patient = await this.patientRepo.findOne({ where: { localId: localPatientId } });
    if (!patient) {
      return { success: false, reason: `Patient not found for queue.add: ${localPatientId}` };
    }

    // Idempotency: avoid duplicate queue entries for same patient+hospital
    const existing = await this.queueRepo.findOne({
      where: {
        patientId: patient.id,
        hospitalId: hospitalId ?? 1,
        status: "waiting",
      },
    });
    if (existing) {
      return { success: true, skipped: true, reason: "Queue entry already exists", serverEntityId: existing.id };
    }

    const entry = this.queueRepo.create({
      patientId: patient.id,
      hospitalId: hospitalId ?? 1,
      serviceType: (payload.service as string) || "General OPD",
      careCategory: this.mapPriority(payload.priority as string),
      priorityReason: (payload.priorityReason as string) || null,
      tokenNumber: (payload.tokenNumber as number) || 0,
      status: "waiting",
    });
    const saved = await this.queueRepo.save(entry);
    return { success: true, serverEntityId: saved.id };
  }

  private async handleQueueStatus(
    localQueueId: string,
    payload: Record<string, unknown> | null,
  ): Promise<DispatchResult> {
    if (!payload?.status) return { success: true, skipped: true, reason: "No status in queue.status payload" };

    // We can't easily find queue entry by local ID without a localId column — best-effort by recent update
    this.logger.debug(`queue.status: ${localQueueId} → ${payload.status}`);
    return { success: true, skipped: true, reason: "Queue status update noted (no server localId mapping)" };
  }

  private async handleQueueOverride(
    localQueueId: string,
    payload: Record<string, unknown> | null,
  ): Promise<DispatchResult> {
    this.logger.debug(`queue.override: ${localQueueId}`);
    return { success: true, skipped: true, reason: "Queue override noted" };
  }

  // ─── Encounter ───────────────────────────────────────────────────────────────

  private async handleEncounterCreate(
    localEncounterId: string,
    payload: Record<string, unknown> | null,
    hospitalId?: number | null,
  ): Promise<DispatchResult> {
    if (!payload) return { success: true, skipped: true, reason: "No payload for encounter.create" };

    // Record as a triage result row (the closest server-side entity)
    const localPatientId = payload.patientId as string;
    const patient = await this.patientRepo.findOne({ where: { localId: localPatientId } });
    if (!patient) {
      return { success: false, reason: `Patient not found for encounter: ${localPatientId}` };
    }

    const existing = await this.triageRepo.findOne({
      where: { patientId: patient.id, hospitalId: hospitalId ?? 1 },
      order: { createdAt: "DESC" },
    });

    // Only create if no recent triage result (idempotency window: 5 minutes)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (existing && existing.createdAt > fiveMinAgo) {
      return { success: true, skipped: true, reason: "Recent encounter already exists", serverEntityId: existing.id };
    }

    const result = this.triageRepo.create({
      patientId: patient.id,
      hospitalId: hospitalId ?? 1,
      careCategory: this.mapPriority((payload.priority as string) || "routine"),
      assessedBy: "offline_device",
      reason: (payload.note as string) || null,
      screeningData: payload as any,
    });
    const saved = await this.triageRepo.save(result);
    return { success: true, serverEntityId: saved.id };
  }

  // ─── Referral ─────────────────────────────────────────────────────────────────

  private async handleReferralCreate(
    localReferralId: string,
    payload: Record<string, unknown> | null,
    hospitalId?: number | null,
  ): Promise<DispatchResult> {
    // TODO: Create a Referral entity when referral module is implemented server-side.
    this.logger.log(`referral.create: ${localReferralId} → destination=${payload?.destination}`);
    return { success: true, skipped: true, reason: "Referral logged (server entity pending)" };
  }

  private async handleReferralStatus(
    localReferralId: string,
    payload: Record<string, unknown> | null,
  ): Promise<DispatchResult> {
    this.logger.log(`referral.status: ${localReferralId} → ${payload?.status}`);
    return { success: true, skipped: true, reason: "Referral status logged (server entity pending)" };
  }

  // ─── Inventory ────────────────────────────────────────────────────────────────

  private async handleInventoryTransaction(
    operationType: string,
    localTransactionId: string,
    payload: Record<string, unknown> | null,
    userId: number,
  ): Promise<DispatchResult> {
    if (!payload) return { success: true, skipped: true, reason: "No payload for inventory operation" };

    const localMedicineId = payload.medicineId as string;
    const medicine = await this.medicineRepo.findOne({ where: { id: parseInt(localMedicineId) || 0 } });
    if (!medicine) {
      this.logger.warn(`inventory: medicine not found for localId=${localMedicineId}`);
      return { success: true, skipped: true, reason: "Medicine not found; inventory update skipped" };
    }

    const txType = operationType.split(".")[1] as any;
    const quantity = (payload.quantity as number) || 0;

    const tx = this.inventoryRepo.create({
      medicineId: medicine.id,
      type: txType === "receipt" ? "restock" : txType === "dispense" ? "dispense" : "adjustment",
      quantity: Math.abs(quantity),
      recordedById: userId,
      notes: `Synced from offline device. localId=${localTransactionId}`,
    });
    const saved = await this.inventoryRepo.save(tx);
    return { success: true, serverEntityId: saved.id };
  }

  // ─── Beds ─────────────────────────────────────────────────────────────────────

  private async handleBedOccupy(
    localBedId: string,
    payload: Record<string, unknown> | null,
    userId: number,
  ): Promise<DispatchResult> {
    if (!payload?.patientId) return { success: true, skipped: true, reason: "No patientId in bed.occupy payload" };

    const bed = await this.bedRepo.findOne({ where: { id: parseInt(localBedId) || 0 } });
    if (!bed) return { success: true, skipped: true, reason: "Bed not found by numeric id; skipping" };

    if (bed.status === "occupied") {
      return { success: true, skipped: true, reason: "Bed already occupied", serverEntityId: bed.id };
    }

    const patientLocalId = payload.patientId as string;
    await this.bedRepo.update(bed.id, {
      status: "occupied",
      occupiedByPatientId: patientLocalId,
      occupiedSince: new Date(),
    });

    const occ = this.bedOccupancyRepo.create({
      bedId: bed.id,
      patientId: patientLocalId,
      status: "occupied",
      occupiedFrom: new Date(),
      recordedBy: String(userId),
      notes: (payload.notes as string) || null,
    });
    await this.bedOccupancyRepo.save(occ);
    return { success: true, serverEntityId: bed.id };
  }

  private async handleBedRelease(
    localBedId: string,
    payload: Record<string, unknown> | null,
    userId: number,
  ): Promise<DispatchResult> {
    const bed = await this.bedRepo.findOne({ where: { id: parseInt(localBedId) || 0 } });
    if (!bed) return { success: true, skipped: true, reason: "Bed not found; skipping release" };

    const previousPatientId = bed.occupiedByPatientId;
    await this.bedRepo.update(bed.id, {
      status: "available",
      occupiedByPatientId: null,
      occupiedSince: null,
    });

    // Close any open occupancy records
    if (previousPatientId) {
      const openOcc = await this.bedOccupancyRepo.findOne({
        where: { bedId: bed.id, patientId: previousPatientId, occupiedUntil: undefined as any },
        order: { occupiedFrom: "DESC" },
      });
      if (openOcc) {
        await this.bedOccupancyRepo.update(openOcc.id, { occupiedUntil: new Date(), recordedBy: String(userId) });
      }
    }

    return { success: true, serverEntityId: bed.id };
  }

  private async handleBedMaintenance(
    localBedId: string,
    payload: Record<string, unknown> | null,
  ): Promise<DispatchResult> {
    const bed = await this.bedRepo.findOne({ where: { id: parseInt(localBedId) || 0 } });
    if (!bed) return { success: true, skipped: true, reason: "Bed not found; skipping maintenance" };

    await this.bedRepo.update(bed.id, { status: "maintenance" });
    return { success: true, serverEntityId: bed.id };
  }

  // ─── Medicine ─────────────────────────────────────────────────────────────────

  private async handleMedicineCreate(
    localMedicineId: string,
    payload: Record<string, unknown> | null,
  ): Promise<DispatchResult> {
    if (!payload?.name) return { success: true, skipped: true, reason: "No name in medicine.create payload" };

    const existing = await this.medicineRepo.findOne({ where: { name: payload.name as string } });
    if (existing) return { success: true, skipped: true, reason: "Medicine already exists", serverEntityId: existing.id };

    const medicine = this.medicineRepo.create({
      name: (payload.name as string).trim(),
      localName: (payload.localName as string) || null,
      category: (payload.category as string) || "general",
      unit: (payload.unit as string) || "units",
      minimumStock: (payload.minimumStock as number) || 0,
      isGovtSupply: (payload.isGovtSupply as boolean) ?? true,
      pricePerUnit: (payload.pricePerUnit as number) || 0,
    });

    const saved = await this.medicineRepo.save(medicine);
    return { success: true, serverEntityId: saved.id };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private parsePayload(raw: string): Record<string, unknown> | null {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private mapPriority(priority: string | undefined): "emergency" | "urgent" | "priority" | "routine" {
    switch (priority) {
      case "emergency": return "emergency";
      case "urgent": return "urgent";
      case "priority": return "priority";
      default: return "routine";
    }
  }
}

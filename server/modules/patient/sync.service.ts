import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan } from "typeorm";
import {
  SyncOperation,
  SyncConflict,
  Patient,
  QueueEntry,
  Bed,
  Medicine,
} from "../../database/entities";
import { SyncDispatcherService } from "./sync-dispatcher.service";

export interface PushOperationInput {
  id: string;
  type: string;
  entityId: string;
  createdAt: number;
  payload?: string;
  deviceId?: string;
  version?: number;
}

export interface ConflictItem {
  operationId: string;
  entityId: string;
  reason: string;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(SyncOperation)
    private readonly syncRepo: Repository<SyncOperation>,
    @InjectRepository(SyncConflict)
    private readonly conflictRepo: Repository<SyncConflict>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(QueueEntry)
    private readonly queueRepo: Repository<QueueEntry>,
    @InjectRepository(Bed)
    private readonly bedRepo: Repository<Bed>,
    @InjectRepository(Medicine)
    private readonly medicineRepo: Repository<Medicine>,
    private readonly dispatcher: SyncDispatcherService,
  ) {}

  async pushOperations(data: {
    userId: number;
    hospitalId?: number;
    operations: PushOperationInput[];
  }): Promise<{ acknowledgedIds: string[]; conflicts: ConflictItem[]; acknowledgedAt: number }> {
    const acknowledgedIds: string[] = [];
    const conflicts: ConflictItem[] = [];

    for (const op of data.operations) {
      try {
        // ── 1. Idempotency Check ───────────────────────────────────────────
        const existing = await this.syncRepo.findOne({
          where: { operationId: op.id },
        });

        if (existing) {
          this.logger.debug(`Duplicate operation ${op.id} — already acknowledged`);
          acknowledgedIds.push(op.id);
          continue;
        }

        // ── 2. Optimistic Version Conflict Check ──────────────────────────
        const clientVersion = op.version || 1;
        let isConflict = false;
        let conflictReason = "";
        let serverStateStr: string | null = null;

        if (op.type.startsWith("patient.")) {
          const patient = await this.patientRepo.findOne({ where: { localId: op.entityId } });
          if (patient && patient.version > clientVersion) {
            isConflict = true;
            conflictReason = `Version conflict: server patient version ${patient.version} > client version ${clientVersion}`;
            serverStateStr = JSON.stringify(patient);
          }
        } else if (op.type.startsWith("queue.")) {
          const queueEntry = await this.queueRepo.findOne({ where: { id: parseInt(op.entityId) || 0 } });
          if (queueEntry && queueEntry.version > clientVersion) {
            isConflict = true;
            conflictReason = `Version conflict: server queue version ${queueEntry.version} > client version ${clientVersion}`;
            serverStateStr = JSON.stringify(queueEntry);
          }
        } else if (op.type.startsWith("bed.")) {
          const bed = await this.bedRepo.findOne({ where: { id: parseInt(op.entityId) || 0 } });
          if (bed && bed.version > clientVersion) {
            isConflict = true;
            conflictReason = `Version conflict: server bed version ${bed.version} > client version ${clientVersion}`;
            serverStateStr = JSON.stringify(bed);
          }
        } else if (op.type.startsWith("medicine.")) {
          const med = await this.medicineRepo.findOne({ where: { id: parseInt(op.entityId) || 0 } });
          if (med && med.version > clientVersion) {
            isConflict = true;
            conflictReason = `Version conflict: server medicine version ${med.version} > client version ${clientVersion}`;
            serverStateStr = JSON.stringify(med);
          }
        }

        if (isConflict) {
          this.logger.warn(`Sync conflict on operation ${op.id} (${op.type}): ${conflictReason}`);
          const conflictRecord = this.conflictRepo.create({
            operationId: op.id,
            deviceId: op.deviceId ?? null,
            entityId: op.entityId,
            reason: conflictReason,
            clientPayload: op.payload ?? null,
            serverState: serverStateStr,
          });
          await this.conflictRepo.save(conflictRecord);
          conflicts.push({
            operationId: op.id,
            entityId: op.entityId,
            reason: conflictReason,
          });
          // Do not process or replay this conflicting operation
          continue;
        }

        // ── 3. Record Operation ────────────────────────────────────────────
        const operation = this.syncRepo.create({
          operationId: op.id,
          userId: data.userId,
          hospitalId: data.hospitalId ?? null,
          operationType: op.type,
          entityId: op.entityId,
          payload: op.payload ?? null,
          deviceId: op.deviceId ?? null,
          version: clientVersion,
          clientCreatedAt: new Date(op.createdAt),
        });
        await this.syncRepo.save(operation);

        // ── 4. Dispatch Operation to Domain Handlers ───────────────────────
        const result = await this.dispatcher.dispatch({
          operationType: op.type,
          entityId: op.entityId,
          payload: op.payload ?? null,
          userId: data.userId,
          hospitalId: data.hospitalId,
        });

        if (result.success) {
          acknowledgedIds.push(op.id);
          if (result.skipped) {
            this.logger.debug(`Operation ${op.id} (${op.type}) skipped: ${result.reason}`);
          } else {
            this.logger.log(`Operation ${op.id} (${op.type}) replayed → serverEntityId=${result.serverEntityId}`);
          }
        } else {
          this.logger.warn(`Operation ${op.id} (${op.type}) failed: ${result.reason}`);
          acknowledgedIds.push(op.id);
        }
      } catch (error) {
        this.logger.error(`Unexpected error processing operation ${op.id}:`, error);
      }
    }

    return { acknowledgedIds, conflicts, acknowledgedAt: Date.now() };
  }

  async getOperationsSince(hospitalId: number, since: Date): Promise<SyncOperation[]> {
    return this.syncRepo.find({
      where: {
        hospitalId,
        clientCreatedAt: MoreThan(since),
      },
      order: { clientCreatedAt: "ASC" },
      take: 500,
    });
  }
}

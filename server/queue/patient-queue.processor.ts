import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CacheService } from "../redis/cache.service";
import { QueueEntry } from "../database/entities";
import { PATIENT_QUEUE } from "./queue.constants";
import { QueueRealtimeService } from "./queue-realtime.service";

export interface PatientQueueJob {
  hospitalId: number;
  patientId: number;
  serviceType: string;
  careCategory: "emergency" | "urgent" | "priority" | "routine";
  priorityReason?: string;
  action: "enqueue" | "call_next" | "call" | "complete" | "transfer" | "pause";
}

@Processor(PATIENT_QUEUE)
export class PatientQueueProcessor {
  private readonly logger = new Logger(PatientQueueProcessor.name);

  constructor(
    private readonly cache: CacheService,
    private readonly realtime: QueueRealtimeService,
    @InjectRepository(QueueEntry) private readonly queueRepo: Repository<QueueEntry>,
  ) {}

  @Process("enqueue")
  async handleEnqueue(job: Job<PatientQueueJob>) {
    const { hospitalId, patientId, serviceType, careCategory, priorityReason } = job.data;
    const queueKey = `queue:hospital:${hospitalId}`;

    const entry = {
      patientId,
      serviceType,
      careCategory,
      priorityReason: priorityReason ?? null,
      status: "waiting" as const,
      enteredAt: Date.now(),
    };

    await this.cache.setHash(queueKey, String(patientId), entry);

    try {
      const maxToken = await this.queueRepo
        .createQueryBuilder("qe")
        .select("MAX(qe.tokenNumber)", "max")
        .where("qe.hospitalId = :hospitalId", { hospitalId })
        .getRawOne();

      const dbEntry = this.queueRepo.create({
        patientId,
        hospitalId,
        serviceType,
        careCategory,
        priorityReason: priorityReason ?? null,
        status: "waiting",
        enteredAt: new Date(),
        tokenNumber: (maxToken?.max ?? 0) + 1,
      });
      await this.queueRepo.save(dbEntry);
    } catch (error) {
      this.logger.error(`Failed to persist enqueue for patient ${patientId}:`, error);
    }

    this.logger.log(`Enqueued patient ${patientId} to hospital ${hospitalId} queue`);
    await this.realtime.publish({ type: "enqueue", hospitalId, patientId, at: Date.now() });
    return { success: true, entry };
  }

  @Process("call_next")
  async handleCallNext(job: Job<{ hospitalId: number; serviceType?: string }>) {
    const { hospitalId, serviceType } = job.data;
    const queueKey = `queue:hospital:${hospitalId}`;
    const allEntries = await this.cache.getAllHash<Record<string, any>>(queueKey);

    if (!allEntries) return { patientId: null };

    const priorityOrder = ["emergency", "urgent", "priority", "routine"];
    const candidates = Object.entries(allEntries)
      .filter(([_, entry]) => entry.status === "waiting")
      .filter(([_, entry]) => !serviceType || entry.serviceType === serviceType)
      .sort(([a, entryA], [b, entryB]) => {
        const pA = priorityOrder.indexOf(entryA.careCategory);
        const pB = priorityOrder.indexOf(entryB.careCategory);
        if (pA !== pB) return pA - pB;
        return entryA.enteredAt - entryB.enteredAt;
      });

    if (candidates.length === 0) return { patientId: null };

    const [patientIdStr, entry] = candidates[0];
    entry.status = "called";
    entry.calledAt = Date.now();
    await this.cache.setHash(queueKey, patientIdStr, entry);

    try {
      await this.queueRepo.update(
        { patientId: Number(patientIdStr), hospitalId, status: "waiting" as any },
        { status: "called" as any, calledAt: new Date() },
      );
    } catch (error) {
      this.logger.error(`Failed to persist call_next for patient ${patientIdStr}:`, error);
    }

    this.logger.log(`Called patient ${patientIdStr} from hospital ${hospitalId} queue`);
    await this.realtime.publish({ type: "call_next", hospitalId, patientId: Number(patientIdStr), at: Date.now() });
    return { patientId: Number(patientIdStr), entry };
  }

  @Process("call")
  async handleCall(job: Job<{ hospitalId: number; patientId: number }>) {
    const { hospitalId, patientId } = job.data;
    const queueKey = `queue:hospital:${hospitalId}`;
    const entry = await this.cache.getHash<any>(queueKey, String(patientId));
    if (entry) {
      entry.status = "called";
      entry.calledAt = Date.now();
      await this.cache.setHash(queueKey, String(patientId), entry);
    }

    try {
      await this.queueRepo.update(
        { patientId, hospitalId, status: "waiting" as any },
        { status: "called" as any, calledAt: new Date() },
      );
    } catch (error) {
      this.logger.error(`Failed to persist call for patient ${patientId}:`, error);
    }

    this.logger.log(`Called patient ${patientId} from hospital ${hospitalId} queue`);
    await this.realtime.publish({ type: "call_next", hospitalId, patientId, at: Date.now() });
    return { success: true, patientId };
  }

  @Process("complete")
  async handleComplete(job: Job<{ hospitalId: number; patientId: number }>) {
    const { hospitalId, patientId } = job.data;
    const queueKey = `queue:hospital:${hospitalId}`;
    const entry = await this.cache.getHash<any>(queueKey, String(patientId));
    if (entry) {
      entry.status = "completed";
      entry.completedAt = Date.now();
      await this.cache.setHash(queueKey, String(patientId), entry);
    }

    try {
      await this.queueRepo.update(
        { patientId, hospitalId, status: "called" as any },
        { status: "completed" as any, completedAt: new Date() },
      );
    } catch (error) {
      this.logger.error(`Failed to persist complete for patient ${patientId}:`, error);
    }

    this.logger.log(`Completed patient ${patientId} at hospital ${hospitalId}`);
    await this.realtime.publish({ type: "complete", hospitalId, patientId, at: Date.now() });
    return { success: true };
  }

  @Process("transfer")
  async handleTransfer(job: Job<{ hospitalId: number; patientId: number; targetHospitalId: number }>) {
    const { hospitalId, patientId, targetHospitalId } = job.data;
    const sourceKey = `queue:hospital:${hospitalId}`;
    const targetKey = `queue:hospital:${targetHospitalId}`;
    const entry = await this.cache.getHash<any>(sourceKey, String(patientId));

    if (entry) {
      entry.hospitalId = targetHospitalId;
      entry.status = "waiting";
      entry.enteredAt = Date.now();
      await this.cache.delHash(sourceKey, String(patientId));
      await this.cache.setHash(targetKey, String(patientId), entry);
    }

    try {
      const dbEntry = await this.queueRepo.findOne({
        where: { patientId, hospitalId, status: "called" as any },
      });
      if (dbEntry) {
        dbEntry.hospitalId = targetHospitalId;
        dbEntry.status = "waiting" as any;
        dbEntry.enteredAt = new Date();
        dbEntry.calledAt = null;
        await this.queueRepo.save(dbEntry);
      }
    } catch (error) {
      this.logger.error(`Failed to persist transfer for patient ${patientId}:`, error);
    }

    this.logger.log(`Transferred patient ${patientId} from hospital ${hospitalId} to ${targetHospitalId}`);
    await this.realtime.publish({ type: "transfer", hospitalId, patientId, targetHospitalId, at: Date.now() });
    return { success: true };
  }

  @Process("pause")
  async handlePause(job: Job<{ hospitalId: number; patientId: number }>) {
    const { hospitalId, patientId } = job.data;
    const queueKey = `queue:hospital:${hospitalId}`;
    const entry = await this.cache.getHash<any>(queueKey, String(patientId));
    if (entry) {
      entry.status = "paused";
      await this.cache.setHash(queueKey, String(patientId), entry);
    }

    try {
      await this.queueRepo.update(
        { patientId, hospitalId, status: "waiting" as any },
        { status: "paused" as any },
      );
    } catch (error) {
      this.logger.error(`Failed to persist pause for patient ${patientId}:`, error);
    }

    this.logger.log(`Paused patient ${patientId} at hospital ${hospitalId}`);
    await this.realtime.publish({ type: "pause", hospitalId, patientId, at: Date.now() });
    return { success: true };
  }
}

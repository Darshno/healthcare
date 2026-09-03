import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { TELECONSULT_QUEUE } from "./queue.constants";

@Injectable()
export class TeleconsultQueueService {
  private readonly logger = new Logger(TeleconsultQueueService.name);

  constructor(
    @InjectQueue(TELECONSULT_QUEUE) private readonly queue: Queue,
  ) {}

  async schedule(data: {
    sessionId: number;
    hospitalId: number;
    patientId: number;
    clinicianId?: number;
  }) {
    return this.queue.add("schedule", data, { removeOnComplete: true });
  }

  async start(sessionId: number, hospitalId: number, clinicianId: number) {
    return this.queue.add("start", { sessionId, hospitalId, clinicianId }, {
      removeOnComplete: true,
    });
  }

  async end(sessionId: number, hospitalId: number) {
    return this.queue.add("end", { sessionId, hospitalId }, {
      removeOnComplete: true,
    });
  }

  async cancel(sessionId: number, hospitalId: number) {
    return this.queue.add("cancel", { sessionId, hospitalId }, {
      removeOnComplete: true,
    });
  }
}

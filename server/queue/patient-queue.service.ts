import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { PATIENT_QUEUE } from "./queue.constants";

@Injectable()
export class PatientQueueService {
  private readonly logger = new Logger(PatientQueueService.name);

  constructor(
    @InjectQueue(PATIENT_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueue(data: {
    hospitalId: number;
    patientId: number;
    serviceType: string;
    careCategory: "emergency" | "urgent" | "priority" | "routine";
    priorityReason?: string;
  }) {
    return this.queue.add("enqueue", data, {
      priority: this.getPriorityValue(data.careCategory),
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async callNext(hospitalId: number, serviceType?: string) {
    return this.queue.add("call_next", { hospitalId, serviceType }, {
      removeOnComplete: true,
    });
  }

  async call(hospitalId: number, patientId: number) {
    return this.queue.add("call", { hospitalId, patientId }, {
      removeOnComplete: true,
    });
  }

  async complete(hospitalId: number, patientId: number) {
    return this.queue.add("complete", { hospitalId, patientId }, {
      removeOnComplete: true,
    });
  }

  async transfer(hospitalId: number, patientId: number, targetHospitalId: number) {
    return this.queue.add("transfer", { hospitalId, patientId, targetHospitalId }, {
      priority: this.getPriorityValue("urgent"),
      removeOnComplete: true,
    });
  }

  async pause(hospitalId: number, patientId: number) {
    return this.queue.add("pause", { hospitalId, patientId }, {
      removeOnComplete: true,
    });
  }

  async getQueueStats(hospitalId: number) {
    const counts = await this.queue.getJobCounts();
    return { hospitalId, ...counts };
  }

  private getPriorityValue(category: string): number {
    switch (category) {
      case "emergency": return 1;
      case "urgent": return 2;
      case "priority": return 3;
      case "routine": return 4;
      default: return 5;
    }
  }
}

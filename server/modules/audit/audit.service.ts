import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLog } from "../../database/entities";

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(data: {
    entity: string;
    entityId: string;
    action: string;
    user?: string | null;
    role?: string | null;
    details?: Record<string, unknown> | string | null;
  }): Promise<AuditLog> {
    const detailsStr =
      typeof data.details === "object" && data.details !== null
        ? JSON.stringify(data.details)
        : (data.details as string) || null;

    const logEntry = this.auditRepo.create({
      entity: data.entity,
      entityId: data.entityId,
      action: data.action,
      user: data.user || null,
      role: data.role || null,
      details: detailsStr,
    });

    const saved = await this.auditRepo.save(logEntry);
    this.logger.log(`[Audit] ${data.action} on ${data.entity}:${data.entityId} by ${data.user || "system"}`);
    return saved;
  }

  async getLogsForEntity(entity: string, entityId: string): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { entity, entityId },
      order: { timestamp: "DESC" },
      take: 100,
    });
  }
}

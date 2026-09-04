import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Patient, SyncOperation, QueueEntry, TriageResult, SyncConflict } from "../../database/entities";
import { Bed } from "../../database/entities/bed.entity";
import { BedOccupancy } from "../../database/entities/bed-occupancy.entity";
import { Medicine } from "../../database/entities/medicine.entity";
import { InventoryTransaction } from "../../database/entities/inventory-transaction.entity";
import { PatientService } from "./patient.service";
import { PatientController, SyncController } from "./patient.controller";
import { SyncService } from "./sync.service";
import { SyncDispatcherService } from "./sync-dispatcher.service";
import { CacheService } from "../../redis/cache.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      SyncOperation,
      SyncConflict,
      QueueEntry,
      TriageResult,
      Bed,
      BedOccupancy,
      Medicine,
      InventoryTransaction,
    ]),
  ],
  providers: [PatientService, SyncService, SyncDispatcherService, CacheService],
  controllers: [PatientController, SyncController],
  exports: [PatientService, SyncService, SyncDispatcherService],
})

export class PatientModule {}

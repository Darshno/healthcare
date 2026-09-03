import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BedsController } from "./beds.controller";
import { BedsService } from "./beds.service";

@Module({
  imports: [
    // Import bed and unit entities when database entities are created
    // TypeOrmModule.forFeature([Bed, HospitalUnit, BedOccupancy])
  ],
  controllers: [BedsController],
  providers: [BedsService],
  exports: [BedsService],
})
export class BedsModule {}

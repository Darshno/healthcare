import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BedsController } from "./beds.controller";
import { BedsService } from "./beds.service";
import { Bed, HospitalUnit, BedOccupancy, Hospital } from "../../database/entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([Bed, HospitalUnit, BedOccupancy, Hospital]),
  ],
  controllers: [BedsController],
  providers: [BedsService],
  exports: [BedsService],
})
export class BedsModule {}

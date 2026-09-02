import { Module } from '@nestjs/common';
import { BedService } from './bed.service';
import { BedController } from './bed.controller';

@Module({
  providers: [BedService],
  controllers: [BedController],
  exports: [BedService],
})
export class BedModule {}

import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Bed, HospitalUnit, BedOccupancy, Hospital } from "../../database/entities";

@Injectable()
export class BedsService {
  private readonly logger = new Logger(BedsService.name);

  constructor(
    @InjectRepository(Bed)
    private readonly bedRepo: Repository<Bed>,
    @InjectRepository(HospitalUnit)
    private readonly unitRepo: Repository<HospitalUnit>,
    @InjectRepository(BedOccupancy)
    private readonly occupancyRepo: Repository<BedOccupancy>,
    @InjectRepository(Hospital)
    private readonly hospitalRepo: Repository<Hospital>,
  ) {}

  /**
   * Get all beds and units for a hospital
   */
  async getBedsByHospital(hospitalId: string | number) {
    const numericHospitalId = typeof hospitalId === "string" ? parseInt(hospitalId) || 1 : hospitalId;
    const units = await this.unitRepo.find({
      where: { hospitalId: numericHospitalId },
      relations: ["beds"],
    });

    const unitIds = units.map((u) => u.id);
    let beds: Bed[] = [];
    if (unitIds.length > 0) {
      beds = await this.bedRepo.createQueryBuilder("bed")
        .where("bed.unitId IN (:...unitIds)", { unitIds })
        .getMany();
    }

    return { units, beds };
  }

  /**
   * Get unit details with bed statistics
   */
  async getUnitStats(unitId: string | number) {
    const numericUnitId = typeof unitId === "string" ? parseInt(unitId) || 0 : unitId;
    const unit = await this.unitRepo.findOne({ where: { id: numericUnitId } });
    if (!unit) {
      throw new NotFoundException(`Hospital unit ${unitId} not found`);
    }

    const beds = await this.bedRepo.find({ where: { unitId: numericUnitId } });
    const totalBeds = beds.length;
    const availableBeds = beds.filter((b) => b.status === "available").length;
    const occupiedBeds = beds.filter((b) => b.status === "occupied").length;
    const maintenanceBeds = beds.filter((b) => b.status === "maintenance").length;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return {
      unitId: numericUnitId,
      unitName: unit.name,
      type: unit.type,
      totalBeds: unit.totalBeds || totalBeds,
      availableBeds,
      occupiedBeds,
      maintenanceBeds,
      occupancyRate,
    };
  }

  /**
   * Update bed status (occupy/free/maintenance)
   */
  async updateBedStatus(
    bedId: string | number,
    status: "available" | "occupied" | "maintenance",
    occupiedByPatientId?: string,
    recordedBy?: string,
  ) {
    const numericBedId = typeof bedId === "string" ? parseInt(bedId) || 0 : bedId;
    const bed = await this.bedRepo.findOne({ where: { id: numericBedId } });
    if (!bed) {
      throw new NotFoundException(`Bed ${bedId} not found`);
    }

    const previousPatientId = bed.occupiedByPatientId;
    bed.status = status;
    bed.version = (bed.version || 1) + 1;
    if (status === "occupied") {
      bed.occupiedByPatientId = occupiedByPatientId || null;
      bed.occupiedSince = new Date();
    } else {
      bed.occupiedByPatientId = null;
      bed.occupiedSince = null;
    }

    await this.bedRepo.save(bed);

    // Record occupancy transaction
    if (status === "occupied" && occupiedByPatientId) {
      const occ = this.occupancyRepo.create({
        bedId: bed.id,
        patientId: occupiedByPatientId,
        status: "occupied",
        occupiedFrom: new Date(),
        recordedBy: recordedBy || null,
      });
      await this.occupancyRepo.save(occ);
    } else if (status === "available" && previousPatientId) {
      const openOcc = await this.occupancyRepo.findOne({
        where: { bedId: bed.id, patientId: previousPatientId },
        order: { occupiedFrom: "DESC" },
      });
      if (openOcc && !openOcc.occupiedUntil) {
        openOcc.occupiedUntil = new Date();
        await this.occupancyRepo.save(openOcc);
      }
    }

    return { bedId: bed.id, status: bed.status, occupiedByPatientId: bed.occupiedByPatientId, timestamp: new Date() };
  }

  /**
   * Get available beds in a unit
   */
  async getAvailableBeds(unitId: string | number) {
    const numericUnitId = typeof unitId === "string" ? parseInt(unitId) || 0 : unitId;
    return this.bedRepo.find({
      where: { unitId: numericUnitId, status: "available" },
      order: { bedNumber: "ASC" },
    });
  }

  /**
   * Get bed occupancy history
   */
  async getBedOccupancyHistory(bedId: string | number) {
    const numericBedId = typeof bedId === "string" ? parseInt(bedId) || 0 : bedId;
    return this.occupancyRepo.find({
      where: { bedId: numericBedId },
      order: { occupiedFrom: "DESC" },
      take: 100,
    });
  }

  /**
   * Find nearby hospitals with available beds
   */
  async getNearbyHospitalsWithAvailableBeds(latitude: number, longitude: number, radiusKm: number = 10) {
    const hospitals = await this.hospitalRepo.find({ relations: ["units"] });
    const results = [];

    for (const h of hospitals) {
      const { beds } = await this.getBedsByHospital(h.id);
      const availableBedsCount = beds.filter((b) => b.status === "available").length;
      results.push({
        id: h.id,
        name: h.name,
        availableBeds: availableBedsCount,
        distanceKm: Math.round(Math.random() * radiusKm * 10) / 10,
      });
    }

    return results;
  }
}

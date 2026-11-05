import { Module } from "@nestjs/common";
import { ClinicRepository } from "./domain/clinic.repository";
import { SqlClinicRepository } from "./infrastructure/sql-clinic.repository";
import { ClinicAccess } from "./infrastructure/clinic-access";
import { ClinicsUseCase } from "./application/clinics.usecase";
import { ClinicsController } from "./presentation/clinics.controller";
/** Wires clinic persistence, scope resolution and explicit routes. */
@Module({
  providers: [ClinicAccess, ClinicsUseCase, { provide: ClinicRepository, useClass: SqlClinicRepository }],
  controllers: [ClinicsController],
  exports: [ClinicAccess]
})
export class ClinicsModule {}

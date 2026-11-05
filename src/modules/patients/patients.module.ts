import { Module } from "@nestjs/common";
import { PatientRepository } from "./domain/patient.repository";
import { SqlPatientRepository } from "./infrastructure/sql-patient.repository";
import { PatientsUseCase } from "./application/patients.usecase";
import { PatientsController } from "./presentation/patients.controller";
import { ClinicsModule } from "../clinics/clinics.module";
/** Provides independent patient records and verified account binding. */
@Module({
  imports: [ClinicsModule],
  providers: [PatientsUseCase, { provide: PatientRepository, useClass: SqlPatientRepository }],
  controllers: [PatientsController],
  exports: [PatientRepository]
})
export class PatientsModule {}

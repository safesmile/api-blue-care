import { PatientsRules } from "./application/patientsRules.service";
import { Module } from "@nestjs/common";
import { PatientRepository } from "./domain/patient.repository";
import { SqlPatientRepository } from "./infrastructure/sql-patient.repository";
import { CrudPatientsUseCase } from "./application/crudPatients.usecase";
import { OwnPatientUseCase } from "./application/ownPatient.usecase";
import { UpdateOwnPatientUseCase } from "./application/updateOwnPatient.usecase";
import { LinkPatientUseCase } from "./application/linkPatient.usecase";
import { AssociatePatientUseCase } from "./application/associatePatient.usecase";
import { ClinicsPatientUseCase } from "./application/clinicsPatient.usecase";
import { DissociatePatientUseCase } from "./application/dissociatePatient.usecase";
import { PatientsController } from "./presentation/patients.controller";
import { ClinicsModule } from "../clinics/clinics.module";
/** Provides independent patient records and verified account binding. */
@Module({
  imports: [ClinicsModule],
  providers: [
    PatientsRules,
    CrudPatientsUseCase,
    OwnPatientUseCase,
    UpdateOwnPatientUseCase,
    LinkPatientUseCase,
    AssociatePatientUseCase,
    ClinicsPatientUseCase,
    DissociatePatientUseCase,
    { provide: PatientRepository, useClass: SqlPatientRepository }
  ],
  controllers: [PatientsController],
  exports: [PatientRepository]
})
export class PatientsModule {}

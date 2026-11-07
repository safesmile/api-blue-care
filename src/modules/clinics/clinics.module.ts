import { AuthorizationModule } from "../authorization/authorization.module";
import { Module } from "@nestjs/common";
import { ClinicRepository } from "./domain/clinic.repository";
import { SqlClinicRepository } from "./infrastructure/sql-clinic.repository";
import { ClinicAccess } from "./infrastructure/clinic-access";
import { AvailableClinicUseCase } from "./application/availableClinic.usecase";
import { CrudClinicsUseCase } from "./application/crudClinics.usecase";
import { StaffClinicUseCase } from "./application/staffClinic.usecase";
import { AssignClinicUseCase } from "./application/assignClinic.usecase";
import { UnassignClinicUseCase } from "./application/unassignClinic.usecase";
import { ClinicsController } from "./presentation/clinics.controller";
/** Wires clinic persistence, scope resolution and explicit routes. */
@Module({
  imports: [AuthorizationModule],
  providers: [
    ClinicAccess,
    AvailableClinicUseCase,
    CrudClinicsUseCase,
    StaffClinicUseCase,
    AssignClinicUseCase,
    UnassignClinicUseCase,
    { provide: ClinicRepository, useClass: SqlClinicRepository }
  ],
  controllers: [ClinicsController],
  exports: [ClinicAccess]
})
export class ClinicsModule {}

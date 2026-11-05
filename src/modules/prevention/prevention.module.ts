import { Module } from "@nestjs/common";
import { ClinicsModule } from "../clinics/clinics.module";
import { PreventionRepository } from "./domain/prevention.repository";
import { SqlPreventionRepository } from "./infrastructure/sql-prevention.repository";
import { PreventionUseCase } from "./application/prevention.usecase";
import { PreventionController } from "./presentation/prevention.controller";
import { PreventionAccountsController } from "./presentation/prevention-accounts.controller";
import { PreventionJobsController } from "./presentation/prevention-jobs.controller";
/**
 * Defines the validated prevention, dashboard or notification contract.
 */
@Module({
  imports: [ClinicsModule],
  providers: [PreventionUseCase, { provide: PreventionRepository, useClass: SqlPreventionRepository }],
  controllers: [PreventionController, PreventionAccountsController, PreventionJobsController]
})
export class PreventionModule {}

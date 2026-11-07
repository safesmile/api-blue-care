import { PreventionRules } from "./application/preventionRules.service";
import { Module } from "@nestjs/common";
import { ClinicsModule } from "../clinics/clinics.module";
import { PreventionRepository } from "./domain/prevention.repository";
import { SqlPreventionRepository } from "./infrastructure/sql-prevention.repository";
import { TypesPreventionEventUseCase } from "./application/typesPreventionEvent.usecase";
import { SaveTypePreventionEventUseCase } from "./application/saveTypePreventionEvent.usecase";
import { CrudPreventionUseCase } from "./application/crudPrevention.usecase";
import { CompletePreventionEventUseCase } from "./application/completePreventionEvent.usecase";
import { CancelPreventionEventUseCase } from "./application/cancelPreventionEvent.usecase";
import { DrainPreventionEventUseCase } from "./application/drainPreventionEvent.usecase";
import { PreventionController } from "./presentation/prevention.controller";
import { PreventionAccountsController } from "./presentation/prevention-accounts.controller";
import { PreventionJobsController } from "./presentation/prevention-jobs.controller";
/**
 * Defines the validated prevention, dashboard or notification contract.
 */
@Module({
  imports: [ClinicsModule],
  providers: [
    PreventionRules,
    TypesPreventionEventUseCase,
    SaveTypePreventionEventUseCase,
    CrudPreventionUseCase,
    CompletePreventionEventUseCase,
    CancelPreventionEventUseCase,
    DrainPreventionEventUseCase,
    { provide: PreventionRepository, useClass: SqlPreventionRepository }
  ],
  controllers: [PreventionController, PreventionAccountsController, PreventionJobsController]
})
export class PreventionModule {}

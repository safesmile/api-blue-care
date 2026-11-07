import { Module } from "@nestjs/common";
import { PlanRepository } from "./domain/plan.repository";
import { SqlPlanRepository } from "./infrastructure/sql-plan.repository";
import { CrudPlansUseCase } from "./application/crudPlans.usecase";
import { CatalogPlanUseCase } from "./application/catalogPlan.usecase";
import { VersionPlanUseCase } from "./application/versionPlan.usecase";
import { VersionsPlanUseCase } from "./application/versionsPlan.usecase";
import { PublishPlanUseCase } from "./application/publishPlan.usecase";
import { PlansController } from "./presentation/plans.controller";
/** Provides versioned commercial definitions. */
@Module({
  providers: [
    CrudPlansUseCase,
    CatalogPlanUseCase,
    VersionPlanUseCase,
    VersionsPlanUseCase,
    PublishPlanUseCase,
    { provide: PlanRepository, useClass: SqlPlanRepository }
  ],
  controllers: [PlansController]
})
export class PlansModule {}

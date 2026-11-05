import { Module } from "@nestjs/common";
import { PlanRepository } from "./domain/plan.repository";
import { SqlPlanRepository } from "./infrastructure/sql-plan.repository";
import { PlansUseCase } from "./application/plans.usecase";
import { PlansController } from "./presentation/plans.controller";
/** Provides versioned commercial definitions. */
@Module({
  providers: [PlansUseCase, { provide: PlanRepository, useClass: SqlPlanRepository }],
  controllers: [PlansController]
})
export class PlansModule {}

import { Module } from "@nestjs/common";
import { ClinicsModule } from "../clinics/clinics.module";
import { BenefitRepository } from "./domain/benefit.repository";
import { BenefitOperationsRepository } from "./domain/benefit-operations.repository";
import { BenefitContext } from "./infrastructure/benefit-context";
import { SqlBenefitRepository } from "./infrastructure/sql-benefit.repository";
import { SqlBenefitOperationsRepository } from "./infrastructure/sql-benefit-operations.repository";
import { BenefitsUseCase } from "./application/benefits.usecase";
import { BenefitOperationsUseCase } from "./application/benefit-operations.usecase";
import { BenefitsController } from "./presentation/benefits.controller";
import { BenefitAccountsController } from "./presentation/benefit-accounts.controller";
import { BenefitConsumptionsController } from "./presentation/benefit-consumptions.controller";
/** Provides global atomic benefit consumption without changing contractual membership prices. */
@Module({
  imports: [ClinicsModule],
  providers: [
    BenefitsUseCase,
    BenefitOperationsUseCase,
    BenefitContext,
    { provide: BenefitRepository, useClass: SqlBenefitRepository },
    { provide: BenefitOperationsRepository, useClass: SqlBenefitOperationsRepository }
  ],
  controllers: [BenefitsController, BenefitAccountsController, BenefitConsumptionsController]
})
export class BenefitsModule {}

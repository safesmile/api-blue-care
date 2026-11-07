import { BenefitOperationsRules } from "./application/benefitOperationsRules.service";
import { Module } from "@nestjs/common";
import { ClinicsModule } from "../clinics/clinics.module";
import { BenefitRepository } from "./domain/benefit.repository";
import { BenefitOperationsRepository } from "./domain/benefit-operations.repository";
import { BenefitContext } from "./infrastructure/benefit-context";
import { SqlBenefitRepository } from "./infrastructure/sql-benefit.repository";
import { SqlBenefitOperationsRepository } from "./infrastructure/sql-benefit-operations.repository";
import { CrudBenefitsUseCase } from "./application/crudBenefits.usecase";
import { VersionBenefitUseCase } from "./application/versionBenefit.usecase";
import { VersionsBenefitUseCase } from "./application/versionsBenefit.usecase";
import { PublishBenefitUseCase } from "./application/publishBenefit.usecase";
import { FamilySettingsBenefitUseCase } from "./application/familySettingsBenefit.usecase";
import { UpdateFamilySettingsBenefitUseCase } from "./application/updateFamilySettingsBenefit.usecase";
import { FamilyBenefitUseCase } from "./application/familyBenefit.usecase";
import { AddBeneficiaryBenefitUseCase } from "./application/addBeneficiaryBenefit.usecase";
import { ReplaceBeneficiaryBenefitUseCase } from "./application/replaceBeneficiaryBenefit.usecase";
import { BalancesBenefitUseCase } from "./application/balancesBenefit.usecase";
import { IssueTicketBenefitUseCase } from "./application/issueTicketBenefit.usecase";
import { ConsumeBenefitUseCase } from "./application/consumeBenefit.usecase";
import { ConsumeTicketBenefitUseCase } from "./application/consumeTicketBenefit.usecase";
import { ReverseBenefitUseCase } from "./application/reverseBenefit.usecase";
import { HistoryBenefitUseCase } from "./application/historyBenefit.usecase";
import { ClinicHistoryBenefitUseCase } from "./application/clinicHistoryBenefit.usecase";
import { BenefitsController } from "./presentation/benefits.controller";
import { BenefitAccountsController } from "./presentation/benefit-accounts.controller";
import { BenefitConsumptionsController } from "./presentation/benefit-consumptions.controller";
/** Provides global atomic benefit consumption without changing contractual membership prices. */
@Module({
  imports: [ClinicsModule],
  providers: [
    BenefitOperationsRules,
    CrudBenefitsUseCase,
    VersionBenefitUseCase,
    VersionsBenefitUseCase,
    PublishBenefitUseCase,
    FamilySettingsBenefitUseCase,
    UpdateFamilySettingsBenefitUseCase,
    FamilyBenefitUseCase,
    AddBeneficiaryBenefitUseCase,
    ReplaceBeneficiaryBenefitUseCase,
    BalancesBenefitUseCase,
    IssueTicketBenefitUseCase,
    ConsumeBenefitUseCase,
    ConsumeTicketBenefitUseCase,
    ReverseBenefitUseCase,
    HistoryBenefitUseCase,
    ClinicHistoryBenefitUseCase,
    BenefitContext,
    { provide: BenefitRepository, useClass: SqlBenefitRepository },
    { provide: BenefitOperationsRepository, useClass: SqlBenefitOperationsRepository }
  ],
  controllers: [BenefitsController, BenefitAccountsController, BenefitConsumptionsController]
})
export class BenefitsModule {}

import { Module } from "@nestjs/common";
import { PatientsModule } from "../patients/patients.module";
import { JobsModule } from "../../infrastructure/jobs/jobs.module";
import { MembershipRepository } from "./domain/membership.repository";
import { MembershipBilling, MembershipGateway } from "./domain/membership-billing";
import { SqlMembershipRepository } from "./infrastructure/sql-membership.repository";
import { SqlMembershipBilling } from "./infrastructure/sql-membership-billing";
import { RecurrenteGateway } from "./infrastructure/recurrente-gateway";
import { MembershipsUseCase } from "./application/memberships.usecase";
import { MembershipsController } from "./presentation/memberships.controller";
import { MembershipJobsController } from "./presentation/membership-jobs.controller";
import { RecurrenteWebhookController } from "./presentation/recurrente-webhook.controller";
/** Wires patient-global contracts, durable billing and verified provider notifications. */
@Module({
  imports: [PatientsModule, JobsModule],
  providers: [
    MembershipsUseCase,
    { provide: MembershipRepository, useClass: SqlMembershipRepository },
    { provide: MembershipGateway, useClass: RecurrenteGateway },
    { provide: MembershipBilling, useClass: SqlMembershipBilling }
  ],
  controllers: [MembershipsController, MembershipJobsController, RecurrenteWebhookController],
  exports: [MembershipsUseCase]
})
export class MembershipsModule {}

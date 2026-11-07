import { MembershipsRules } from "./application/membershipsRules.service";
import { Module } from "@nestjs/common";
import { PatientsModule } from "../patients/patients.module";
import { JobsModule } from "../../infrastructure/jobs/jobs.module";
import { MembershipRepository } from "./domain/membership.repository";
import { MembershipBilling, MembershipGateway } from "./domain/membership-billing";
import { SqlMembershipRepository } from "./infrastructure/sql-membership.repository";
import { SqlMembershipBilling } from "./infrastructure/sql-membership-billing";
import { RecurrenteGateway } from "./infrastructure/recurrente-gateway";
import { CrudMembershipsUseCase } from "./application/crudMemberships.usecase";
import { CreateOwnMembershipUseCase } from "./application/createOwnMembership.usecase";
import { CancelMembershipUseCase } from "./application/cancelMembership.usecase";
import { SuspendMembershipUseCase } from "./application/suspendMembership.usecase";
import { PeriodsMembershipUseCase } from "./application/periodsMembership.usecase";
import { CheckoutMembershipUseCase } from "./application/checkoutMembership.usecase";
import { ReceiveMembershipUseCase } from "./application/receiveMembership.usecase";
import { DrainMembershipUseCase } from "./application/drainMembership.usecase";
import { MembershipsController } from "./presentation/memberships.controller";
import { MembershipJobsController } from "./presentation/membership-jobs.controller";
import { RecurrenteWebhookController } from "./presentation/recurrente-webhook.controller";
/** Wires patient-global contracts, durable billing and verified provider notifications. */
@Module({
  imports: [PatientsModule, JobsModule],
  providers: [
    MembershipsRules,
    CrudMembershipsUseCase,
    CreateOwnMembershipUseCase,
    CancelMembershipUseCase,
    SuspendMembershipUseCase,
    PeriodsMembershipUseCase,
    CheckoutMembershipUseCase,
    ReceiveMembershipUseCase,
    DrainMembershipUseCase,
    { provide: MembershipRepository, useClass: SqlMembershipRepository },
    { provide: MembershipGateway, useClass: RecurrenteGateway },
    { provide: MembershipBilling, useClass: SqlMembershipBilling }
  ],
  controllers: [MembershipsController, MembershipJobsController, RecurrenteWebhookController],
  exports: [
    CrudMembershipsUseCase,
    CreateOwnMembershipUseCase,
    CancelMembershipUseCase,
    SuspendMembershipUseCase,
    PeriodsMembershipUseCase,
    CheckoutMembershipUseCase,
    ReceiveMembershipUseCase,
    DrainMembershipUseCase
  ]
})
export class MembershipsModule {}

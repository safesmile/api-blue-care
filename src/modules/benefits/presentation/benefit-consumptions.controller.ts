import { PermissionCode } from "../../../shared/domain/permission-code";
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { FamilyBenefitUseCase } from "../application/familyBenefit.usecase";
import { AddBeneficiaryBenefitUseCase } from "../application/addBeneficiaryBenefit.usecase";
import { ReplaceBeneficiaryBenefitUseCase } from "../application/replaceBeneficiaryBenefit.usecase";
import { BalancesBenefitUseCase } from "../application/balancesBenefit.usecase";
import { ConsumeBenefitUseCase } from "../application/consumeBenefit.usecase";
import { ConsumeTicketBenefitUseCase } from "../application/consumeTicketBenefit.usecase";
import { ReverseBenefitUseCase } from "../application/reverseBenefit.usecase";
import { HistoryBenefitUseCase } from "../application/historyBenefit.usecase";
import { ClinicHistoryBenefitUseCase } from "../application/clinicHistoryBenefit.usecase";
import {
  ConsumeBenefitDto,
  ConsumeTicketDto,
  ReverseConsumptionDto,
  BalanceQueryDto,
  BeneficiaryDto
} from "./benefits.dto";
import { PaginationDto } from "../../identity/presentation/user.dto";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
/** Consumption needs clinic authority; correction uses the original clinic and never moves quota between periods. */
@Controller("benefits")
export class BenefitConsumptionsController {
  /**
   * Recibe las dependencias de la operación.
   * @param familyBenefit Dependencia tipada de familyBenefit.
   * @param addBeneficiaryBenefit Dependencia tipada de addBeneficiaryBenefit.
   * @param replaceBeneficiaryBenefit Dependencia tipada de replaceBeneficiaryBenefit.
   * @param balancesBenefit Dependencia tipada de balancesBenefit.
   * @param consumeBenefit Dependencia tipada de consumeBenefit.
   * @param consumeTicketBenefit Dependencia tipada de consumeTicketBenefit.
   * @param reverseBenefit Dependencia tipada de reverseBenefit.
   * @param historyBenefit Dependencia tipada de historyBenefit.
   * @param clinicHistoryBenefit Dependencia tipada de clinicHistoryBenefit.
   */
  constructor(
    private readonly familyBenefit: FamilyBenefitUseCase,
    private readonly addBeneficiaryBenefit: AddBeneficiaryBenefitUseCase,
    private readonly replaceBeneficiaryBenefit: ReplaceBeneficiaryBenefitUseCase,
    private readonly balancesBenefit: BalancesBenefitUseCase,
    private readonly consumeBenefit: ConsumeBenefitUseCase,
    private readonly consumeTicketBenefit: ConsumeTicketBenefitUseCase,
    private readonly reverseBenefit: ReverseBenefitUseCase,
    private readonly historyBenefit: HistoryBenefitUseCase,
    private readonly clinicHistoryBenefit: ClinicHistoryBenefitUseCase
  ) {}
  /**
   * Records an authorized service against global quota.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("consumptions") @Permissions(PermissionCode.BenefitsConsume) consume(
    @Body() input: ConsumeBenefitDto,
    @Req() request: AuthRequest
  ) {
    return this.consumeBenefit.execute(input, request.user);
  }
  /**
   * Redeems the owner presentation in an authorized clinic.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("tickets/consume") @Permissions(PermissionCode.BenefitsConsume) consumeTicket(
    @Body() input: ConsumeTicketDto,
    @Req() request: AuthRequest
  ) {
    return this.consumeTicketBenefit.execute(input, request.user);
  }
  /**
   * Reverses a consumption in its original period with a mandatory reason.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("consumptions/:id/reverse") @Permissions(PermissionCode.BenefitsReverse) reverse(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ReverseConsumptionDto,
    @Req() request: AuthRequest
  ) {
    return this.reverseBenefit.execute(id, input.reason, input.idempotencyKey, request.user);
  }
  /**
   * Lists consumption evidence restricted to the authorized clinic.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("clinics/:id/history") @Permissions(PermissionCode.BenefitsHistory) clinicHistory(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.clinicHistoryBenefit.execute(id, page, request.user);
  }
  /**
   * Reads global quota across clinics for the selected recipient.
   * @param id Resource identifier.
   * @param query Bounded explicit catalog filters.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("memberships/:id/balances") @Permissions(PermissionCode.BenefitsBalances) balances(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: BalanceQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.balancesBenefit.execute(id, query.beneficiaryId, query, request.user);
  }
  /**
   * Lists the authorized membership consumption history.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("memberships/:id/history") @Permissions(PermissionCode.BenefitsHistory) history(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.historyBenefit.execute(id, page, request.user);
  }
  /**
   * Lists the patient family independently of contract renewal.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("memberships/:id/family") @Permissions(PermissionCode.BenefitsBalances) family(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.familyBenefit.execute(id, page, request.user);
  }
  /**
   * Adds a relative within the current configured limit.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("memberships/:id/family") @Permissions(PermissionCode.BenefitsFamilyManage) addBeneficiary(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: BeneficiaryDto,
    @Req() request: AuthRequest
  ) {
    return this.addBeneficiaryBenefit.execute(id, input, request.user);
  }
  /**
   * Replaces a relative after the annual lock has elapsed.
   * @param id Resource identifier.
   * @param beneficiaryId Selected family member, or omitted for the holder.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("memberships/:id/family/:beneficiaryId/replace")
  @Permissions(PermissionCode.BenefitsFamilyManage)
  replaceBeneficiary(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("beneficiaryId", ParseUUIDPipe) beneficiaryId: string,
    @Body() input: BeneficiaryDto,
    @Req() request: AuthRequest
  ) {
    return this.replaceBeneficiaryBenefit.execute(id, beneficiaryId, input, request.user);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { BenefitOperationsUseCase } from "../application/benefit-operations.usecase";
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
   * Initializes the benefit service dependencies.
   * @param operations Benefit operations repository or application service.
   */
  constructor(private readonly operations: BenefitOperationsUseCase) {}
  /**
   * Records an authorized service against global quota.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("consumptions") @Permissions("benefits:consume") consume(
    @Body() input: ConsumeBenefitDto,
    @Req() request: AuthRequest
  ) {
    return this.operations.consume(input, request.user);
  }
  /**
   * Redeems the owner presentation in an authorized clinic.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("tickets/consume") @Permissions("benefits:consume") consumeTicket(
    @Body() input: ConsumeTicketDto,
    @Req() request: AuthRequest
  ) {
    return this.operations.consumeTicket(input, request.user);
  }
  /**
   * Reverses a consumption in its original period with a mandatory reason.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("consumptions/:id/reverse") @Permissions("benefits:reverse") reverse(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ReverseConsumptionDto,
    @Req() request: AuthRequest
  ) {
    return this.operations.reverse(id, input.reason, input.idempotencyKey, request.user);
  }
  /**
   * Lists consumption evidence restricted to the authorized clinic.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("clinics/:id/history") @Permissions("benefits:history") clinicHistory(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.operations.clinicHistory(id, page, request.user);
  }
  /**
   * Reads global quota across clinics for the selected recipient.
   * @param id Resource identifier.
   * @param query Bounded explicit catalog filters.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("memberships/:id/balances") @Permissions("benefits:balances") balances(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: BalanceQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.operations.balances(id, query.beneficiaryId, query, request.user);
  }
  /**
   * Lists the authorized membership consumption history.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("memberships/:id/history") @Permissions("benefits:history") history(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.operations.history(id, page, request.user);
  }
  /**
   * Lists the patient family independently of contract renewal.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("memberships/:id/family") @Permissions("benefits:balances") family(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.operations.family(id, page, request.user);
  }
  /**
   * Adds a relative within the current configured limit.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("memberships/:id/family") @Permissions("benefits:family-manage") addBeneficiary(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: BeneficiaryDto,
    @Req() request: AuthRequest
  ) {
    return this.operations.addBeneficiary(id, input, request.user);
  }
  /**
   * Replaces a relative after the annual lock has elapsed.
   * @param id Resource identifier.
   * @param beneficiaryId Selected family member, or omitted for the holder.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("memberships/:id/family/:beneficiaryId/replace") @Permissions("benefits:family-manage") replaceBeneficiary(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("beneficiaryId", ParseUUIDPipe) beneficiaryId: string,
    @Body() input: BeneficiaryDto,
    @Req() request: AuthRequest
  ) {
    return this.operations.replaceBeneficiary(id, beneficiaryId, input, request.user);
  }
}

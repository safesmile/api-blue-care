import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { BenefitOperationsUseCase } from "../application/benefit-operations.usecase";
import { BalanceQueryDto, BeneficiaryDto, BenefitTicketDto } from "./benefits.dto";
import { PaginationDto } from "../../identity/presentation/user.dto";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
/** Owner routes always validate the persisted patient-account relationship. */
@Controller("benefits/me/:membershipId")
export class BenefitAccountsController {
  /**
   * Initializes the benefit service dependencies.
   * @param operations Benefit operations repository or application service.
   */
  constructor(private readonly operations: BenefitOperationsUseCase) {}
  /**
   * Reads global quota across clinics for the selected recipient.
   * @param id Resource identifier.
   * @param query Bounded explicit catalog filters.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("balances") @Permissions("benefits:self") balances(
    @Param("membershipId", ParseUUIDPipe) id: string,
    @Query() query: BalanceQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.operations.balances(id, query.beneficiaryId, query, request.user, true);
  }
  /**
   * Lists the patient family independently of contract renewal.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("family") @Permissions("benefits:self") family(
    @Param("membershipId", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.operations.family(id, page, request.user, true);
  }
  /**
   * Adds a relative within the current configured limit.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("family") @Permissions("benefits:self") addBeneficiary(
    @Param("membershipId", ParseUUIDPipe) id: string,
    @Body() input: BeneficiaryDto,
    @Req() request: AuthRequest
  ) {
    return this.operations.addBeneficiary(id, input, request.user, true);
  }
  /**
   * Replaces a relative after the annual lock has elapsed.
   * @param id Resource identifier.
   * @param beneficiaryId Selected family member, or omitted for the holder.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("family/:beneficiaryId/replace") @Permissions("benefits:self") replaceBeneficiary(
    @Param("membershipId", ParseUUIDPipe) id: string,
    @Param("beneficiaryId", ParseUUIDPipe) beneficiaryId: string,
    @Body() input: BeneficiaryDto,
    @Req() request: AuthRequest
  ) {
    return this.operations.replaceBeneficiary(id, beneficiaryId, input, request.user, true);
  }
  /**
   * Issues a short-lived owner presentation without reserving quota.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("tickets") @Permissions("benefits:self") @Header("Cache-Control", "no-store") issueTicket(
    @Param("membershipId", ParseUUIDPipe) id: string,
    @Body() input: BenefitTicketDto,
    @Req() request: AuthRequest
  ) {
    return this.operations.issueTicket(id, input, request.user);
  }
  /**
   * Lists the authorized membership consumption history.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("history") @Permissions("benefits:self") history(
    @Param("membershipId", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.operations.history(id, page, request.user, true);
  }
}

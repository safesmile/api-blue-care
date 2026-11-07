import { PermissionCode } from "../../../shared/domain/permission-code";
import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { FamilyBenefitUseCase } from "../application/familyBenefit.usecase";
import { AddBeneficiaryBenefitUseCase } from "../application/addBeneficiaryBenefit.usecase";
import { ReplaceBeneficiaryBenefitUseCase } from "../application/replaceBeneficiaryBenefit.usecase";
import { BalancesBenefitUseCase } from "../application/balancesBenefit.usecase";
import { IssueTicketBenefitUseCase } from "../application/issueTicketBenefit.usecase";
import { HistoryBenefitUseCase } from "../application/historyBenefit.usecase";
import { BalanceQueryDto, BeneficiaryDto, BenefitTicketDto } from "./benefits.dto";
import { PaginationDto } from "../../identity/presentation/user.dto";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
/** Owner routes always validate the persisted patient-account relationship. */
@Controller("benefits/me/:membershipId")
export class BenefitAccountsController {
  /**
   * Recibe las dependencias de la operación.
   * @param familyBenefit Dependencia tipada de familyBenefit.
   * @param addBeneficiaryBenefit Dependencia tipada de addBeneficiaryBenefit.
   * @param replaceBeneficiaryBenefit Dependencia tipada de replaceBeneficiaryBenefit.
   * @param balancesBenefit Dependencia tipada de balancesBenefit.
   * @param issueTicketBenefit Dependencia tipada de issueTicketBenefit.
   * @param historyBenefit Dependencia tipada de historyBenefit.
   */
  constructor(
    private readonly familyBenefit: FamilyBenefitUseCase,
    private readonly addBeneficiaryBenefit: AddBeneficiaryBenefitUseCase,
    private readonly replaceBeneficiaryBenefit: ReplaceBeneficiaryBenefitUseCase,
    private readonly balancesBenefit: BalancesBenefitUseCase,
    private readonly issueTicketBenefit: IssueTicketBenefitUseCase,
    private readonly historyBenefit: HistoryBenefitUseCase
  ) {}
  /**
   * Reads global quota across clinics for the selected recipient.
   * @param id Resource identifier.
   * @param query Bounded explicit catalog filters.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("balances") @Permissions(PermissionCode.BenefitsSelf) balances(
    @Param("membershipId", ParseUUIDPipe) id: string,
    @Query() query: BalanceQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.balancesBenefit.execute(id, query.beneficiaryId, query, request.user, true);
  }
  /**
   * Lists the patient family independently of contract renewal.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("family") @Permissions(PermissionCode.BenefitsSelf) family(
    @Param("membershipId", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.familyBenefit.execute(id, page, request.user, true);
  }
  /**
   * Adds a relative within the current configured limit.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("family") @Permissions(PermissionCode.BenefitsSelf) addBeneficiary(
    @Param("membershipId", ParseUUIDPipe) id: string,
    @Body() input: BeneficiaryDto,
    @Req() request: AuthRequest
  ) {
    return this.addBeneficiaryBenefit.execute(id, input, request.user, true);
  }
  /**
   * Replaces a relative after the annual lock has elapsed.
   * @param id Resource identifier.
   * @param beneficiaryId Selected family member, or omitted for the holder.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("family/:beneficiaryId/replace") @Permissions(PermissionCode.BenefitsSelf) replaceBeneficiary(
    @Param("membershipId", ParseUUIDPipe) id: string,
    @Param("beneficiaryId", ParseUUIDPipe) beneficiaryId: string,
    @Body() input: BeneficiaryDto,
    @Req() request: AuthRequest
  ) {
    return this.replaceBeneficiaryBenefit.execute(id, beneficiaryId, input, request.user, true);
  }
  /**
   * Issues a short-lived owner presentation without reserving quota.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("tickets") @Permissions(PermissionCode.BenefitsSelf) @Header("Cache-Control", "no-store") issueTicket(
    @Param("membershipId", ParseUUIDPipe) id: string,
    @Body() input: BenefitTicketDto,
    @Req() request: AuthRequest
  ) {
    return this.issueTicketBenefit.execute(id, input, request.user);
  }
  /**
   * Lists the authorized membership consumption history.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("history") @Permissions(PermissionCode.BenefitsSelf) history(
    @Param("membershipId", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.historyBenefit.execute(id, page, request.user, true);
  }
}

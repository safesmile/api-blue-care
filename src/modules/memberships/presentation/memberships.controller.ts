import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { MembershipsUseCase } from "../application/memberships.usecase";
import { OwnMembershipDto, CreateMembershipDto, MembershipQueryDto } from "./memberships.dto";
import { PaginationDto } from "../../identity/presentation/user.dto";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
/** Separates own patient contracts from clinic-scoped administrative operations. */
@Controller("memberships")
export class MembershipsController {
  /**
   * Receives the persistence and policy boundaries.
   * @param memberships Patient-global membership repository port.
   */
  constructor(private readonly memberships: MembershipsUseCase) {}
  /**
   * Creates a contract for the account-linked patient only.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("me") @Permissions("memberships:self") createOwn(@Body() input: OwnMembershipDto, @Req() request: AuthRequest) {
    return this.memberships.createOwn(input, request.user);
  }
  /**
   * Lists contracts of the account-linked patient.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("me") @Permissions("memberships:self") ownList(@Query() page: PaginationDto, @Req() request: AuthRequest) {
    return this.memberships.list(page, request.user, true);
  }
  /**
   * Reads only a contract of the account-linked patient.
   * @param id Resource identifier.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("me/:id") @Permissions("memberships:self") ownRead(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.memberships.read(id, request.user, true);
  }
  /**
   * Lists paid periods of the account-linked contract.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("me/:id/periods") @Permissions("memberships:self") ownPeriods(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.memberships.periods(id, page, request.user, true);
  }
  /**
   * Obtains one durable hosted quote without repeating ambiguous provider creation.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("me/:id/checkout") @Permissions("memberships:self") checkout(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.memberships.checkout(id, request.user);
  }
  /**
   * Requests cancellation for the account-linked patient.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("me/:id/cancel") @Permissions("memberships:self") cancelOwn(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.memberships.cancel(id, request.user, true);
  }
  /**
   * Creates an explicitly authorized pending record.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post() @Permissions("memberships:create") create(@Body() input: CreateMembershipDto, @Req() request: AuthRequest) {
    return this.memberships.create(input, request.user);
  }
  /**
   * Returns a bounded page within the caller scope.
   * @param query Bounded explicit search filters.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get() @Permissions("memberships:list") list(@Query() query: MembershipQueryDto, @Req() request: AuthRequest) {
    return this.memberships.list(query, request.user);
  }
  /**
   * Reads one authorized resource without changing its state.
   * @param id Resource identifier.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get(":id") @Permissions("memberships:read") read(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.memberships.read(id, request.user);
  }
  /**
   * Lists immutable payments and their allocated periods.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get(":id/periods") @Permissions("memberships:read") periods(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.memberships.periods(id, page, request.user);
  }
  /**
   * Stops future renewals while preserving confirmed paid coverage.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post(":id/cancel") @Permissions("memberships:cancel") cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.memberships.cancel(id, request.user);
  }
  /**
   * Suspends benefit eligibility immediately and queues billing pause.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post(":id/suspend") @Permissions("memberships:suspend") suspend(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.memberships.suspend(id, request.user);
  }
}

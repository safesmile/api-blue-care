import { CrudEntityController } from "../../../shared/presentation/crud.controller";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { CrudMembershipsUseCase } from "../application/crudMemberships.usecase";
import { CreateOwnMembershipUseCase } from "../application/createOwnMembership.usecase";
import { CancelMembershipUseCase } from "../application/cancelMembership.usecase";
import { SuspendMembershipUseCase } from "../application/suspendMembership.usecase";
import { PeriodsMembershipUseCase } from "../application/periodsMembership.usecase";
import { CheckoutMembershipUseCase } from "../application/checkoutMembership.usecase";
import { OwnMembershipDto, CreateMembershipDto, MembershipQueryDto } from "./memberships.dto";
import { PaginationDto } from "../../identity/presentation/user.dto";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import { Permissions } from "../../auth/presentation/auth.decorators";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
/** Separates own patient contracts from clinic-scoped administrative operations. */
@Controller("memberships")
export class MembershipsController extends CrudEntityController<CrudMembershipsUseCase> {
  /**
   * Recibe las dependencias de la operación.
   * @param memberships Dependencia tipada de memberships.
   * @param createOwnMembership Dependencia tipada de createOwnMembership.
   * @param cancelMembership Dependencia tipada de cancelMembership.
   * @param suspendMembership Dependencia tipada de suspendMembership.
   * @param periodsMembership Dependencia tipada de periodsMembership.
   * @param checkoutMembership Dependencia tipada de checkoutMembership.
   */
  constructor(
    memberships: CrudMembershipsUseCase,
    private readonly createOwnMembership: CreateOwnMembershipUseCase,
    private readonly cancelMembership: CancelMembershipUseCase,
    private readonly suspendMembership: SuspendMembershipUseCase,
    private readonly periodsMembership: PeriodsMembershipUseCase,
    private readonly checkoutMembership: CheckoutMembershipUseCase
  ) {
    super(memberships);
  }
  /**
   * Creates a contract for the account-linked patient only.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("me") @Permissions(PermissionCode.MembershipsSelf) createOwn(
    @Body() input: OwnMembershipDto,
    @Req() request: AuthRequest
  ) {
    return this.createOwnMembership.execute(input, request.user);
  }
  /**
   * Lists contracts of the account-linked patient.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("me") @Permissions(PermissionCode.MembershipsSelf) ownList(
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("list", page, request.user, true);
  }
  /**
   * Reads only a contract of the account-linked patient.
   * @param id Resource identifier.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("me/:id") @Permissions(PermissionCode.MembershipsSelf) ownRead(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.crud("read", id, request.user, true);
  }
  /**
   * Lists paid periods of the account-linked contract.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get("me/:id/periods") @Permissions(PermissionCode.MembershipsSelf) ownPeriods(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.periodsMembership.execute(id, page, request.user, true);
  }
  /**
   * Obtains one durable hosted quote without repeating ambiguous provider creation.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("me/:id/checkout") @Permissions(PermissionCode.MembershipsSelf) checkout(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.checkoutMembership.execute(id, request.user);
  }
  /**
   * Requests cancellation for the account-linked patient.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("me/:id/cancel") @Permissions(PermissionCode.MembershipsSelf) cancelOwn(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.cancelMembership.execute(id, request.user, true);
  }
  /**
   * Creates an explicitly authorized pending record.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post() @Permissions(PermissionCode.MembershipsCreate) create(
    @Body() input: CreateMembershipDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("create", input, request.user);
  }
  /**
   * Returns a bounded page within the caller scope.
   * @param query Bounded explicit search filters.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get() @Permissions(PermissionCode.MembershipsList) list(
    @Query() query: MembershipQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("list", query, request.user);
  }
  /**
   * Reads one authorized resource without changing its state.
   * @param id Resource identifier.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get(":id") @Permissions(PermissionCode.MembershipsRead) read(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest
  ) {
    return this.crud("read", id, request.user);
  }
  /**
   * Lists immutable payments and their allocated periods.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Get(":id/periods") @Permissions(PermissionCode.MembershipsRead) periods(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() page: PaginationDto,
    @Req() request: AuthRequest
  ) {
    return this.periodsMembership.execute(id, page, request.user);
  }
  /**
   * Stops future renewals while preserving confirmed paid coverage.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post(":id/cancel") @Permissions(PermissionCode.MembershipsCancel) cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.cancelMembership.execute(id, request.user);
  }
  /**
   * Suspends benefit eligibility immediately and queues billing pause.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post(":id/suspend") @Permissions(PermissionCode.MembershipsSuspend) suspend(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: AuditReasonDto,
    @Req() request: AuthRequest
  ) {
    void input;
    return this.suspendMembership.execute(id, request.user);
  }
}

import { CrudEntityController } from "../../../shared/presentation/crud.controller";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { InvitePatientInvitationUseCase } from "../application/invitePatientInvitation.usecase";
import { InviteCollaboratorInvitationUseCase } from "../application/inviteCollaboratorInvitation.usecase";
import { CollaboratorRolesInvitationUseCase } from "../application/collaboratorRolesInvitation.usecase";
import { CrudInvitationsUseCase } from "../application/crudInvitations.usecase";
import { PreviewInvitationUseCase } from "../application/previewInvitation.usecase";
import { AcceptInvitationUseCase } from "../application/acceptInvitation.usecase";
import { ResendInvitationUseCase } from "../application/resendInvitation.usecase";
import { RevokeInvitationUseCase } from "../application/revokeInvitation.usecase";
import { AUTH_PERMISSIONS } from "../domain/auth.permissions";
import { Permissions, Public } from "./auth.decorators";
import type { AuthRequest } from "./auth.guard";
import { PUBLIC_USE_CASES } from "./auth.throttle";
import {
  CreateInvitationDto,
  AcceptInvitationDto,
  InvitationTokenDto,
  InvitePatientDto,
  InviteCollaboratorDto,
  ClinicRoleQueryDto,
  InvitationQueryDto
} from "./invitation.dto";
/**
 * Exposes invitation management and public token verification.
 */
@Controller("auth/invitations")
export class InvitationsController extends CrudEntityController<CrudInvitationsUseCase> {
  /**
   * Recibe las dependencias de la operación.
   * @param invitePatientInvitation Dependencia tipada de invitePatientInvitation.
   * @param inviteCollaboratorInvitation Dependencia tipada de inviteCollaboratorInvitation.
   * @param collaboratorRolesInvitation Dependencia tipada de collaboratorRolesInvitation.
   * @param invitations Dependencia tipada de invitations.
   * @param previewInvitation Dependencia tipada de previewInvitation.
   * @param acceptInvitation Dependencia tipada de acceptInvitation.
   * @param resendInvitation Dependencia tipada de resendInvitation.
   * @param revokeInvitation Dependencia tipada de revokeInvitation.
   */
  constructor(
    private readonly invitePatientInvitation: InvitePatientInvitationUseCase,
    private readonly inviteCollaboratorInvitation: InviteCollaboratorInvitationUseCase,
    private readonly collaboratorRolesInvitation: CollaboratorRolesInvitationUseCase,
    invitations: CrudInvitationsUseCase,
    private readonly previewInvitation: PreviewInvitationUseCase,
    private readonly acceptInvitation: AcceptInvitationUseCase,
    private readonly resendInvitation: ResendInvitationUseCase,
    private readonly revokeInvitation: RevokeInvitationUseCase
  ) {
    super(invitations);
  }
  /**
   * Invites a patient without accepting caller-selected roles or staff assignments.
   * @param input Patient contact.
   * @param request Current clinic context.
   * @returns Invitation metadata.
   */
  @Post("patients") @Permissions(PermissionCode.InvitationsCreate, PermissionCode.PatientsLink) invitePatient(
    @Body() input: InvitePatientDto,
    @Req() request: AuthRequest
  ) {
    return this.invitePatientInvitation.execute(input, request.user);
  }
  /**
   * Invites a collaborator to an explicitly authorized clinic and role.
   * @param input Collaborator contact and assignment.
   * @param request Current inviter.
   * @returns Invitation metadata.
   */
  @Post("collaborators")
  @Permissions(PermissionCode.InvitationsCreate, PermissionCode.RolesAssign, PermissionCode.ClinicsStaffManage)
  inviteCollaborator(@Body() input: InviteCollaboratorDto, @Req() request: AuthRequest) {
    return this.inviteCollaboratorInvitation.execute(input, request.user);
  }
  /**
   * Supplies current delegable role options for the collaborator form.
   * @param query Explicit destination clinic.
   * @param request Current inviter.
   * @returns Allowed roles for this clinic.
   */
  @Get("collaborators/roles")
  @Permissions(PermissionCode.RolesAssign, PermissionCode.ClinicsStaffManage)
  collaboratorRoles(@Query() query: ClinicRoleQueryDto, @Req() request: AuthRequest) {
    return this.collaboratorRolesInvitation.execute(query.clinicId, request.user);
  }
  /**
   * Creates the resource using the supplied input.
   * @param input Validated input for this operation.
   * @param request HTTP request containing the authenticated profile.
   * @returns Result of the completed operation.
   */
  @Post() @Permissions(AUTH_PERMISSIONS.invite.shortcode, PermissionCode.RolesAssign) create(
    @Body() input: CreateInvitationDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("create", input, request.user);
  }
  /**
   * Returns a bounded page of resources and its total count.
   * @param page Bounded pagination values.
   * @param request Authenticated request and session context.
   * @returns Result of the completed operation.
   */
  @Get() @Permissions(AUTH_PERMISSIONS.listInvitations.shortcode) list(
    @Query() page: InvitationQueryDto,
    @Req() request: AuthRequest
  ) {
    return this.crud("list", page, request.user);
  }
  /**
   * Returns the metadata of a valid invitation credential.
   * @param input Validated input for this operation.
   * @returns Result of the completed operation.
   */
  @Public()
  @Header("Cache-Control", "no-store")
  @Get("by-token")
  @Throttle({ default: PUBLIC_USE_CASES.previewInvitation })
  preview(@Query() input: InvitationTokenDto) {
    return this.previewInvitation.execute(input.token);
  }
  /**
   * Consumes a valid invitation and establishes verified credentials.
   * @param input Validated input for this operation.
   * @returns Result of the completed operation.
   */
  @Public() @Post("accept") @HttpCode(204) @Throttle({ default: PUBLIC_USE_CASES.acceptInvitation }) accept(
    @Body() input: AcceptInvitationDto
  ) {
    return this.acceptInvitation.execute(input.token, input.password);
  }
  /**
   * Rotates an invitation token before delivering a new link.
   * @param id Resource identifier.
   * @param request HTTP request containing the authenticated profile.
   * @param _input Validated optional audit reason.
   * @returns Result of the completed operation.
   */
  @Post(":id/resend")
  @HttpCode(200)
  @Permissions(AUTH_PERMISSIONS.resendInvitation.shortcode)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  resend(@Param("id", ParseUUIDPipe) id: string, @Req() request: AuthRequest, @Body() _input: AuditReasonDto = {}) {
    void _input; // Validation prevents arbitrary request metadata from being captured.
    return this.resendInvitation.execute(id, request.user);
  }
  /**
   * Revokes the invitation without removing its audit history.
   * @param id Resource identifier.
   * @param request HTTP request carrying the verified identity.
   * @param _input Validated optional audit reason.
   * @returns Result of the completed operation.
   */
  @Post(":id/revoke") @HttpCode(204) @Permissions(AUTH_PERMISSIONS.revokeInvitation.shortcode) revoke(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthRequest,
    @Body() _input: AuditReasonDto = {}
  ) {
    void _input;
    return this.revokeInvitation.execute(id, request.user);
  }
}

import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { InvitationsUseCase } from "../application/invitations.usecase";
import { AUTH_PERMISSIONS } from "../domain/auth.permissions";
import { Permissions, Public } from "./auth.decorators";
import type { AuthRequest } from "./auth.guard";
import { PUBLIC_USE_CASES } from "./auth.throttle";
import { CreateInvitationDto, AcceptInvitationDto, InvitationTokenDto } from "./invitation.dto";
import { PaginationDto } from "../../identity/presentation/user.dto";
/**
 * Exposes invitation management and public token verification.
 */
@Controller("auth/invitations")
export class InvitationsController {
  /**
   * Receives the dependencies required by this component.
   * @param invitations Invitation repository or application service.
   */
  constructor(private readonly invitations: InvitationsUseCase) {}
  /**
   * Creates the resource using the supplied input.
   * @param input Validated input for this operation.
   * @param request HTTP request containing the authenticated profile.
   * @returns Result of the completed operation.
   */
  @Post() @Permissions(AUTH_PERMISSIONS.invite.shortcode, "roles:assign") create(
    @Body() input: CreateInvitationDto,
    @Req() request: AuthRequest
  ) {
    return this.invitations.create(input, request.user);
  }
  /**
   * Returns a bounded page of resources and its total count.
   * @param page Bounded pagination values.
   * @returns Result of the completed operation.
   */
  @Get() @Permissions(AUTH_PERMISSIONS.listInvitations.shortcode) list(@Query() page: PaginationDto) {
    return this.invitations.list(page);
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
    return this.invitations.preview(input.token);
  }
  /**
   * Consumes a valid invitation and establishes verified credentials.
   * @param input Validated input for this operation.
   * @returns Result of the completed operation.
   */
  @Public() @Post("accept") @HttpCode(204) @Throttle({ default: PUBLIC_USE_CASES.acceptInvitation }) accept(
    @Body() input: AcceptInvitationDto
  ) {
    return this.invitations.accept(input.token, input.password);
  }
  /**
   * Rotates an invitation token before delivering a new link.
   * @param id Resource identifier.
   * @param request HTTP request containing the authenticated profile.
   * @returns Result of the completed operation.
   */
  @Post(":id/resend")
  @HttpCode(200)
  @Permissions(AUTH_PERMISSIONS.resendInvitation.shortcode, "roles:assign")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  resend(@Param("id", ParseUUIDPipe) id: string, @Req() request: AuthRequest) {
    return this.invitations.resend(id, request.user);
  }
  /**
   * Revokes the invitation without removing its audit history.
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  @Post(":id/revoke") @HttpCode(204) @Permissions(AUTH_PERMISSIONS.revokeInvitation.shortcode) revoke(
    @Param("id", ParseUUIDPipe) id: string
  ) {
    return this.invitations.revoke(id);
  }
}

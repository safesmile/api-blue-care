import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AccountActionsUseCase } from "../application/account-actions.usecase";
import { AUTH_PERMISSIONS } from "../domain/auth.permissions";
import { Permissions, Public } from "./auth.decorators";
import { PUBLIC_USE_CASES } from "./auth.throttle";
import type { AuthRequest } from "./auth.guard";
import { EmailDto, RedeemDto, TokenDto, ChangePasswordDto, ChangeEmailDto } from "./account-actions.dto";
/**
 * Exposes invitation and password recovery endpoints.
 */
@Controller("auth")
export class AccountActionsController {
  /**
   * Receives the dependencies required by this component.
   * @param actions Account action repository or application service.
   */
  constructor(private readonly actions: AccountActionsUseCase) {}
  /**
   * Acknowledges a password recovery request.
   * @param input Validated input for this operation.
   * @returns Result of the completed operation.
   */
  @Public()
  @Post("password/forgot")
  @HttpCode(202)
  @Throttle({ default: PUBLIC_USE_CASES.forgotPassword })
  async forgot(@Body() input: EmailDto) {
    await this.actions.forgotPassword(input.email);
    return { message: "If the account is eligible, a verification email will be sent" };
  }
  /**
   * Replaces a password using a recovery token.
   * @param input Validated input for this operation.
   * @returns Result of the completed operation.
   */
  @Public() @Post("password/reset") @HttpCode(204) @Throttle({ default: PUBLIC_USE_CASES.resetPassword }) reset(
    @Body() input: RedeemDto
  ) {
    return this.actions.redeem("reset", input.token, input.password);
  }
  /**
   * Acknowledges activation without disclosing account existence.
   * @param input Validated input for this operation.
   * @returns Result of the completed operation.
   */
  @Public()
  @Post("activation/request")
  @HttpCode(202)
  @Throttle({ default: PUBLIC_USE_CASES.activation })
  async activation(@Body() input: EmailDto) {
    await this.actions.requestActivation(input.email);
    return { message: "If the account is eligible, a verification email will be sent" };
  }
  /**
   * Verifies a contact token and activates its existing identity.
   * @param input Validated input for this operation.
   * @returns Result of the completed operation.
   */
  @Public() @Post("activation/confirm") @HttpCode(204) @Throttle({ default: PUBLIC_USE_CASES.activation }) activate(
    @Body() input: RedeemDto
  ) {
    return this.actions.redeem("activate", input.token, input.password);
  }
  /**
   * Changes the authenticated account credentials and revokes its sessions.
   * @param input Validated input for this operation.
   * @param request HTTP request containing the authenticated profile.
   * @returns Result of the completed operation.
   */
  @Post("password/change")
  @HttpCode(204)
  @Permissions(AUTH_PERMISSIONS.changePassword.shortcode)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  changePassword(@Body() input: ChangePasswordDto, @Req() request: AuthRequest) {
    return this.actions.changePassword(request.user.id, input.currentPassword, input.newPassword);
  }
  /**
   * Requests verification of the authenticated account's new contact.
   * @param input Validated input for this operation.
   * @param request HTTP request containing the authenticated profile.
   * @returns Result of the completed operation.
   */
  @Post("email/change")
  @HttpCode(202)
  @Permissions(AUTH_PERMISSIONS.changeEmail.shortcode)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async changeEmail(@Body() input: ChangeEmailDto, @Req() request: AuthRequest) {
    await this.actions.requestEmailChange(request.user.id, input.email, input.currentPassword);
    return { message: "Verification sent to the new email" };
  }
  /**
   * Consumes new-contact verification before changing the stored email.
   * @param input Validated input for this operation.
   * @returns Result of the completed operation.
   */
  @Public() @Post("email/confirm") @HttpCode(204) @Throttle({ default: PUBLIC_USE_CASES.activation }) confirmEmail(
    @Body() input: TokenDto
  ) {
    return this.actions.confirmEmail(input.token);
  }
}

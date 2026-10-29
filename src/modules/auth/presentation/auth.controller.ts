import { AUTH_PERMISSIONS } from "../domain/auth.permissions";
import { Throttle } from "@nestjs/throttler";
import { PUBLIC_USE_CASES } from "./auth.throttle";
import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { AuthUseCase } from "../application/auth.usecase";
import { Public, Permissions } from "./auth.decorators";
import { LoginDto, RefreshDto } from "./auth.dto";
import type { AuthRequest } from "./auth.guard";
/**
 * Exposes authentication endpoints with explicit HTTP contracts.
 */
@Controller("auth")
export class AuthController {
  /**
   * Receives the dependencies required by this component.
   * @param auth Value required by this operation.
   */
  constructor(private readonly auth: AuthUseCase) {}
  /**
   * Validates credentials and creates a persisted session.
   * @param input Validated input for this operation.
   * @returns Access credentials for the new session.
   */
  @Public() @Post("login") @Throttle({ default: PUBLIC_USE_CASES.login }) @HttpCode(200) login(
    @Body() input: LoginDto
  ) {
    return this.auth.login(input.email, input.password);
  }
  /**
   * Consumes a refresh token and returns its replacement credentials.
   * @param input Validated input for this operation.
   * @returns Access credentials for the new session.
   */
  @Public() @Post("refresh") @Throttle({ default: PUBLIC_USE_CASES.refresh }) @HttpCode(200) refresh(
    @Body() input: RefreshDto
  ) {
    return this.auth.refresh(input.refreshToken);
  }
  /**
   * Revokes the session identified by a refresh token.
   * @param input Validated input for this operation.
   * @returns Result of the completed operation.
   */
  @Public() @Post("logout") @Throttle({ default: PUBLIC_USE_CASES.logout }) @HttpCode(204) logout(
    @Body() input: RefreshDto
  ) {
    return this.auth.logout(input.refreshToken);
  }
  /**
   * Returns the profile resolved by authentication.
   * @param request HTTP request containing the authenticated profile.
   * @returns Result of the completed operation.
   */
  @Get("me") @Permissions(AUTH_PERMISSIONS.me.shortcode) me(@Req() request: AuthRequest) {
    return request.user;
  }
}

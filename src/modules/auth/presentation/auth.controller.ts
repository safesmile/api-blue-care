import { AUTH_PERMISSIONS } from "../domain/auth.permissions";
import { Throttle } from "@nestjs/throttler";
import { PUBLIC_USE_CASES } from "./auth.throttle";
import { ForbiddenException, Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { LoginSessionUseCase } from "../application/loginSession.usecase";
import { RefreshSessionUseCase } from "../application/refreshSession.usecase";
import { LogoutSessionUseCase } from "../application/logoutSession.usecase";
import { Public, Permissions } from "./auth.decorators";
import { LoginDto, RefreshDto, SwitchClinicDto } from "./auth.dto";
import type { AuthRequest } from "./auth.guard";
/**
 * Exposes authentication endpoints with explicit HTTP contracts.
 */
@Controller("auth")
export class AuthController {
  /**
   * Recibe las dependencias de la operación.
   * @param loginSession Dependencia tipada de loginSession.
   * @param refreshSession Dependencia tipada de refreshSession.
   * @param logoutSession Dependencia tipada de logoutSession.
   */
  constructor(
    private readonly loginSession: LoginSessionUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly logoutSession: LogoutSessionUseCase
  ) {}
  /**
   * Validates credentials and creates a persisted session.
   * @param input Validated input for this operation.
   * @returns Access credentials for the new session.
   */
  @Public() @Post("login") @Throttle({ default: PUBLIC_USE_CASES.login }) @HttpCode(200) login(
    @Body() input: LoginDto
  ) {
    return this.loginSession.execute(input.email, input.password, input.clinicId ?? null);
  }
  /**
   * Consumes a refresh token and returns its replacement credentials.
   * @param input Validated input for this operation.
   * @returns Access credentials for the new session.
   */
  @Public() @Post("refresh") @Throttle({ default: PUBLIC_USE_CASES.refresh }) @HttpCode(200) refresh(
    @Body() input: RefreshDto
  ) {
    return this.refreshSession.execute(input.refreshToken);
  }
  /**
   * Revokes the session identified by a refresh token.
   * @param input Validated input for this operation.
   * @returns Result of the completed operation.
   */
  @Public() @Post("logout") @Throttle({ default: PUBLIC_USE_CASES.logout }) @HttpCode(204) logout(
    @Body() input: RefreshDto
  ) {
    return this.logoutSession.execute(input.refreshToken);
  }
  /**
   * Rotates both credentials while preserving the absolute session deadline.
   * @param input Current refresh credential and target clinic selection.
   * @param request Authenticated session owner.
   * @returns Credentials for the selected clinic context.
   */
  @Post("switch-clinic")
  @HttpCode(200)
  @Permissions(AUTH_PERMISSIONS.me.shortcode)
  switchClinic(@Body() input: SwitchClinicDto, @Req() request: AuthRequest) {
    if (request.user.mode !== "staff") throw new ForbiddenException("Solo el personal puede seleccionar una clínica");
    return this.refreshSession.execute(input.refreshToken, input.clinicId, request.user.id, request.sessionId);
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

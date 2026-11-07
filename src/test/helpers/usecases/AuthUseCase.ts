import { AuthRules } from "../../../modules/auth/application/authRules.service";
import { ClinicContextRepository } from "../../../modules/authorization/domain/clinic-context.repository";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { IdentityRepository } from "../../../modules/identity/domain/identity.repository";
import { PasswordHasher } from "../../../modules/identity/domain/password-hasher";
import { SessionRepository } from "../../../modules/auth/domain/session.repository";
import { LoginSessionUseCase } from "../../../modules/auth/application/loginSession.usecase";
import { RefreshSessionUseCase } from "../../../modules/auth/application/refreshSession.usecase";
import { LogoutSessionUseCase } from "../../../modules/auth/application/logoutSession.usecase";
/** Adaptador de pruebas de regresión; no se registra en la aplicación. */
export class AuthUseCase {
  private readonly LoginSessionUseCase: LoginSessionUseCase;
  private readonly RefreshSessionUseCase: RefreshSessionUseCase;
  private readonly LogoutSessionUseCase: LogoutSessionUseCase;
  /**
   * Recibe las dependencias de la operación.
   * @param users Dependencia tipada de users.
   * @param passwords Dependencia tipada de passwords.
   * @param sessions Dependencia tipada de sessions.
   * @param jwt Dependencia tipada de jwt.
   * @param config Dependencia tipada de config.
   * @param contexts Dependencia tipada de contexts.
   */
  constructor(
    users: IdentityRepository,
    passwords: PasswordHasher,
    sessions: SessionRepository,
    jwt: JwtService,
    config: ConfigService,
    contexts: ClinicContextRepository
  ) {
    this.LoginSessionUseCase = new LoginSessionUseCase(
      users,
      passwords,
      sessions,
      contexts,
      new AuthRules(jwt, config)
    );
    this.RefreshSessionUseCase = new RefreshSessionUseCase(users, sessions, contexts, new AuthRules(jwt, config));
    this.LogoutSessionUseCase = new LogoutSessionUseCase(sessions);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  login(...args: Parameters<LoginSessionUseCase["execute"]>): ReturnType<LoginSessionUseCase["execute"]> {
    return this.LoginSessionUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  refresh(...args: Parameters<RefreshSessionUseCase["execute"]>): ReturnType<RefreshSessionUseCase["execute"]> {
    return this.RefreshSessionUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  logout(...args: Parameters<LogoutSessionUseCase["execute"]>): ReturnType<LogoutSessionUseCase["execute"]> {
    return this.LogoutSessionUseCase.execute(...args);
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static controllerArguments(value: any): [LoginSessionUseCase, RefreshSessionUseCase, LogoutSessionUseCase] {
    return [
      { execute: value.login } as LoginSessionUseCase,
      { execute: value.refresh } as RefreshSessionUseCase,
      { execute: value.logout } as LogoutSessionUseCase
    ];
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static providers(value: any) {
    return [
      { provide: LoginSessionUseCase, useValue: { execute: value.login } },
      { provide: RefreshSessionUseCase, useValue: { execute: value.refresh } },
      { provide: LogoutSessionUseCase, useValue: { execute: value.logout } }
    ];
  }
  /**
   *
   * @param app Entrada de la operación.
   * @param app.get Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static resolve(app: { get(token: any): any }) {
    return {
      login: (...args: Parameters<LoginSessionUseCase["execute"]>) => app.get(LoginSessionUseCase).execute(...args),
      refresh: (...args: Parameters<RefreshSessionUseCase["execute"]>) =>
        app.get(RefreshSessionUseCase).execute(...args),
      logout: (...args: Parameters<LogoutSessionUseCase["execute"]>) => app.get(LogoutSessionUseCase).execute(...args)
    };
  }
}

import { AccountActionsRules } from "../../../modules/auth/application/accountActionsRules.service";
import { AccountActionsRepository, AccountMailer } from "../../../modules/auth/domain/account-actions.repository";
import { IdentityRepository } from "../../../modules/identity/domain/identity.repository";
import { PasswordHasher } from "../../../modules/identity/domain/password-hasher";
import { ForgotPasswordAccountUseCase } from "../../../modules/auth/application/forgotPasswordAccount.usecase";
import { RequestActivationAccountUseCase } from "../../../modules/auth/application/requestActivationAccount.usecase";
import { RedeemAccountUseCase } from "../../../modules/auth/application/redeemAccount.usecase";
import { ChangePasswordAccountUseCase } from "../../../modules/auth/application/changePasswordAccount.usecase";
import { RequestEmailChangeAccountUseCase } from "../../../modules/auth/application/requestEmailChangeAccount.usecase";
import { ConfirmEmailAccountUseCase } from "../../../modules/auth/application/confirmEmailAccount.usecase";
/** Adaptador de pruebas de regresión; no se registra en la aplicación. */
export class AccountActionsUseCase {
  private readonly ForgotPasswordAccountUseCase: ForgotPasswordAccountUseCase;
  private readonly RequestActivationAccountUseCase: RequestActivationAccountUseCase;
  private readonly RedeemAccountUseCase: RedeemAccountUseCase;
  private readonly ChangePasswordAccountUseCase: ChangePasswordAccountUseCase;
  private readonly RequestEmailChangeAccountUseCase: RequestEmailChangeAccountUseCase;
  private readonly ConfirmEmailAccountUseCase: ConfirmEmailAccountUseCase;
  /**
   * Recibe las dependencias de la operación.
   * @param actions Dependencia tipada de actions.
   * @param mail Dependencia tipada de mail.
   * @param users Dependencia tipada de users.
   * @param passwords Dependencia tipada de passwords.
   */
  constructor(
    actions: AccountActionsRepository,
    mail: AccountMailer,
    users: IdentityRepository,
    passwords: PasswordHasher
  ) {
    this.ForgotPasswordAccountUseCase = new ForgotPasswordAccountUseCase(
      users,
      new AccountActionsRules(actions, mail, users, passwords)
    );
    this.RequestActivationAccountUseCase = new RequestActivationAccountUseCase(
      users,
      new AccountActionsRules(actions, mail, users, passwords)
    );
    this.RedeemAccountUseCase = new RedeemAccountUseCase(actions, passwords);
    this.ChangePasswordAccountUseCase = new ChangePasswordAccountUseCase(
      actions,
      passwords,
      new AccountActionsRules(actions, mail, users, passwords)
    );
    this.RequestEmailChangeAccountUseCase = new RequestEmailChangeAccountUseCase(
      users,
      new AccountActionsRules(actions, mail, users, passwords)
    );
    this.ConfirmEmailAccountUseCase = new ConfirmEmailAccountUseCase(actions);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  forgotPassword(
    ...args: Parameters<ForgotPasswordAccountUseCase["execute"]>
  ): ReturnType<ForgotPasswordAccountUseCase["execute"]> {
    return this.ForgotPasswordAccountUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  requestActivation(
    ...args: Parameters<RequestActivationAccountUseCase["execute"]>
  ): ReturnType<RequestActivationAccountUseCase["execute"]> {
    return this.RequestActivationAccountUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  redeem(...args: Parameters<RedeemAccountUseCase["execute"]>): ReturnType<RedeemAccountUseCase["execute"]> {
    return this.RedeemAccountUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  changePassword(
    ...args: Parameters<ChangePasswordAccountUseCase["execute"]>
  ): ReturnType<ChangePasswordAccountUseCase["execute"]> {
    return this.ChangePasswordAccountUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  requestEmailChange(
    ...args: Parameters<RequestEmailChangeAccountUseCase["execute"]>
  ): ReturnType<RequestEmailChangeAccountUseCase["execute"]> {
    return this.RequestEmailChangeAccountUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  confirmEmail(
    ...args: Parameters<ConfirmEmailAccountUseCase["execute"]>
  ): ReturnType<ConfirmEmailAccountUseCase["execute"]> {
    return this.ConfirmEmailAccountUseCase.execute(...args);
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static providers(value: any) {
    return [
      { provide: ForgotPasswordAccountUseCase, useValue: { execute: value.forgotPassword } },
      { provide: RequestActivationAccountUseCase, useValue: { execute: value.requestActivation } },
      { provide: RedeemAccountUseCase, useValue: { execute: value.redeem } },
      { provide: ChangePasswordAccountUseCase, useValue: { execute: value.changePassword } },
      { provide: RequestEmailChangeAccountUseCase, useValue: { execute: value.requestEmailChange } },
      { provide: ConfirmEmailAccountUseCase, useValue: { execute: value.confirmEmail } }
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
      forgotPassword: (...args: Parameters<ForgotPasswordAccountUseCase["execute"]>) =>
        app.get(ForgotPasswordAccountUseCase).execute(...args),
      requestActivation: (...args: Parameters<RequestActivationAccountUseCase["execute"]>) =>
        app.get(RequestActivationAccountUseCase).execute(...args),
      redeem: (...args: Parameters<RedeemAccountUseCase["execute"]>) => app.get(RedeemAccountUseCase).execute(...args),
      changePassword: (...args: Parameters<ChangePasswordAccountUseCase["execute"]>) =>
        app.get(ChangePasswordAccountUseCase).execute(...args),
      requestEmailChange: (...args: Parameters<RequestEmailChangeAccountUseCase["execute"]>) =>
        app.get(RequestEmailChangeAccountUseCase).execute(...args),
      confirmEmail: (...args: Parameters<ConfirmEmailAccountUseCase["execute"]>) =>
        app.get(ConfirmEmailAccountUseCase).execute(...args)
    };
  }
}

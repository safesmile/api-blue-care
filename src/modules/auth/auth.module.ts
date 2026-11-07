import { InvitationsRules } from "./application/invitationsRules.service";
import { AuthRules } from "./application/authRules.service";
import { AccountActionsRules } from "./application/accountActionsRules.service";
import { EmailModule } from "../../infrastructure/email/email.module";
import { InvitationModel } from "./infrastructure/invitation.model";
import { InvitationRepository } from "./domain/invitation.repository";
import { SequelizeInvitationRepository } from "./infrastructure/sequelize-invitation.repository";
import { InvitePatientInvitationUseCase } from "./application/invitePatientInvitation.usecase";
import { InviteCollaboratorInvitationUseCase } from "./application/inviteCollaboratorInvitation.usecase";
import { CollaboratorRolesInvitationUseCase } from "./application/collaboratorRolesInvitation.usecase";
import { CrudInvitationsUseCase } from "./application/crudInvitations.usecase";
import { PreviewInvitationUseCase } from "./application/previewInvitation.usecase";
import { AcceptInvitationUseCase } from "./application/acceptInvitation.usecase";
import { ResendInvitationUseCase } from "./application/resendInvitation.usecase";
import { RevokeInvitationUseCase } from "./application/revokeInvitation.usecase";
import { InvitationsController } from "./presentation/invitations.controller";
import { AuthorizationModule } from "../authorization/authorization.module";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { SequelizeModule } from "@nestjs/sequelize";
import { IdentityModule } from "../identity/identity.module";
import { SessionModel } from "./infrastructure/session.model";
import { SessionRepository } from "./domain/session.repository";
import { SequelizeSessionRepository } from "./infrastructure/sequelize-session.repository";
import { LoginSessionUseCase } from "./application/loginSession.usecase";
import { RefreshSessionUseCase } from "./application/refreshSession.usecase";
import { LogoutSessionUseCase } from "./application/logoutSession.usecase";
import { AuthGuard } from "./presentation/auth.guard";
import { AuthController } from "./presentation/auth.controller";
import { AccountActionModel } from "./infrastructure/account-action.model";
import { AccountActionsRepository, AccountMailer } from "./domain/account-actions.repository";
import { SequelizeAccountActionsRepository } from "./infrastructure/sequelize-account-actions.repository";
import { SmtpAccountMailer } from "./infrastructure/smtp-account-mailer";
import { ForgotPasswordAccountUseCase } from "./application/forgotPasswordAccount.usecase";
import { RequestActivationAccountUseCase } from "./application/requestActivationAccount.usecase";
import { RedeemAccountUseCase } from "./application/redeemAccount.usecase";
import { ChangePasswordAccountUseCase } from "./application/changePasswordAccount.usecase";
import { RequestEmailChangeAccountUseCase } from "./application/requestEmailChangeAccount.usecase";
import { ConfirmEmailAccountUseCase } from "./application/confirmEmailAccount.usecase";
import { AccountActionsController } from "./presentation/account-actions.controller";
/**
 * Wires the providers and controllers for this module.
 */
@Module({
  imports: [
    EmailModule,
    IdentityModule,
    AuthorizationModule,
    SequelizeModule.forFeature([SessionModel, AccountActionModel, InvitationModel]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET")
      })
    })
  ],
  controllers: [AuthController, AccountActionsController, InvitationsController],
  providers: [
    InvitationsRules,
    AuthRules,
    AccountActionsRules,
    InvitePatientInvitationUseCase,
    InviteCollaboratorInvitationUseCase,
    CollaboratorRolesInvitationUseCase,
    CrudInvitationsUseCase,
    PreviewInvitationUseCase,
    AcceptInvitationUseCase,
    ResendInvitationUseCase,
    RevokeInvitationUseCase,
    { provide: InvitationRepository, useClass: SequelizeInvitationRepository },
    ForgotPasswordAccountUseCase,
    RequestActivationAccountUseCase,
    RedeemAccountUseCase,
    ChangePasswordAccountUseCase,
    RequestEmailChangeAccountUseCase,
    ConfirmEmailAccountUseCase,
    {
      provide: AccountActionsRepository,
      useClass: SequelizeAccountActionsRepository
    },
    { provide: AccountMailer, useClass: SmtpAccountMailer },
    LoginSessionUseCase,
    RefreshSessionUseCase,
    LogoutSessionUseCase,
    { provide: SessionRepository, useClass: SequelizeSessionRepository },
    { provide: APP_GUARD, useClass: AuthGuard }
  ]
})
export class AuthModule {}

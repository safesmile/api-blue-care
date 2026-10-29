import { InvitationModel } from "./infrastructure/invitation.model";
import { InvitationRepository } from "./domain/invitation.repository";
import { SequelizeInvitationRepository } from "./infrastructure/sequelize-invitation.repository";
import { InvitationsUseCase } from "./application/invitations.usecase";
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
import { AuthUseCase } from "./application/auth.usecase";
import { AuthGuard } from "./presentation/auth.guard";
import { AuthController } from "./presentation/auth.controller";
import { AccountActionModel } from "./infrastructure/account-action.model";
import { AccountActionsRepository, AccountMailer } from "./domain/account-actions.repository";
import { SequelizeAccountActionsRepository } from "./infrastructure/sequelize-account-actions.repository";
import { SmtpAccountMailer } from "./infrastructure/smtp-account-mailer";
import { AccountActionsUseCase } from "./application/account-actions.usecase";
import { AccountActionsController } from "./presentation/account-actions.controller";
/**
 * Wires the providers and controllers for this module.
 */
@Module({
  imports: [
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
    InvitationsUseCase,
    { provide: InvitationRepository, useClass: SequelizeInvitationRepository },
    AccountActionsUseCase,
    {
      provide: AccountActionsRepository,
      useClass: SequelizeAccountActionsRepository
    },
    { provide: AccountMailer, useClass: SmtpAccountMailer },
    AuthUseCase,
    { provide: SessionRepository, useClass: SequelizeSessionRepository },
    { provide: APP_GUARD, useClass: AuthGuard }
  ]
})
export class AuthModule {}

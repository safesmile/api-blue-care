import { InvitationsRules } from "../../../modules/auth/application/invitationsRules.service";
import { RolesRepository } from "../../../modules/authorization/domain/roles.repository";

import { InvitationRepository } from "../../../modules/auth/domain/invitation.repository";
import { AccountMailer } from "../../../modules/auth/domain/account-actions.repository";
import { PasswordHasher } from "../../../modules/identity/domain/password-hasher";
import { InvitePatientInvitationUseCase } from "../../../modules/auth/application/invitePatientInvitation.usecase";
import { InviteCollaboratorInvitationUseCase } from "../../../modules/auth/application/inviteCollaboratorInvitation.usecase";
import { CollaboratorRolesInvitationUseCase } from "../../../modules/auth/application/collaboratorRolesInvitation.usecase";
import { CrudInvitationsUseCase } from "../../../modules/auth/application/crudInvitations.usecase";
import { PreviewInvitationUseCase } from "../../../modules/auth/application/previewInvitation.usecase";
import { AcceptInvitationUseCase } from "../../../modules/auth/application/acceptInvitation.usecase";
import { ResendInvitationUseCase } from "../../../modules/auth/application/resendInvitation.usecase";
import { RevokeInvitationUseCase } from "../../../modules/auth/application/revokeInvitation.usecase";
/** Adaptador de pruebas de regresión; no se registra en la aplicación. */
export class InvitationsUseCase {
  private readonly InvitePatientInvitationUseCase: InvitePatientInvitationUseCase;
  private readonly InviteCollaboratorInvitationUseCase: InviteCollaboratorInvitationUseCase;
  private readonly CollaboratorRolesInvitationUseCase: CollaboratorRolesInvitationUseCase;
  private readonly CrudInvitationsUseCase: CrudInvitationsUseCase;
  private readonly PreviewInvitationUseCase: PreviewInvitationUseCase;
  private readonly AcceptInvitationUseCase: AcceptInvitationUseCase;
  private readonly ResendInvitationUseCase: ResendInvitationUseCase;
  private readonly RevokeInvitationUseCase: RevokeInvitationUseCase;
  /**
   * Recibe las dependencias de la operación.
   * @param invitations Dependencia tipada de invitations.
   * @param mail Dependencia tipada de mail.
   * @param passwords Dependencia tipada de passwords.
   * @param roles Dependencia tipada de roles.
   */
  constructor(
    invitations: InvitationRepository,
    mail: AccountMailer,
    passwords: PasswordHasher,
    roles: RolesRepository
  ) {
    this.InvitePatientInvitationUseCase = new InvitePatientInvitationUseCase(
      new CrudInvitationsUseCase(invitations, roles, new InvitationsRules(invitations, mail))
    );
    this.InviteCollaboratorInvitationUseCase = new InviteCollaboratorInvitationUseCase(
      new CrudInvitationsUseCase(invitations, roles, new InvitationsRules(invitations, mail))
    );
    this.CollaboratorRolesInvitationUseCase = new CollaboratorRolesInvitationUseCase(
      roles,
      new InvitationsRules(invitations, mail)
    );
    this.CrudInvitationsUseCase = new CrudInvitationsUseCase(
      invitations,
      roles,
      new InvitationsRules(invitations, mail)
    );
    this.PreviewInvitationUseCase = new PreviewInvitationUseCase(new InvitationsRules(invitations, mail));
    this.AcceptInvitationUseCase = new AcceptInvitationUseCase(
      invitations,
      passwords,
      new InvitationsRules(invitations, mail)
    );
    this.ResendInvitationUseCase = new ResendInvitationUseCase(
      invitations,
      roles,
      new InvitationsRules(invitations, mail)
    );
    this.RevokeInvitationUseCase = new RevokeInvitationUseCase(invitations, new InvitationsRules(invitations, mail));
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  invitePatient(
    ...args: Parameters<InvitePatientInvitationUseCase["execute"]>
  ): ReturnType<InvitePatientInvitationUseCase["execute"]> {
    return this.InvitePatientInvitationUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  inviteCollaborator(
    ...args: Parameters<InviteCollaboratorInvitationUseCase["execute"]>
  ): ReturnType<InviteCollaboratorInvitationUseCase["execute"]> {
    return this.InviteCollaboratorInvitationUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  collaboratorRoles(
    ...args: Parameters<CollaboratorRolesInvitationUseCase["execute"]>
  ): ReturnType<CollaboratorRolesInvitationUseCase["execute"]> {
    return this.CollaboratorRolesInvitationUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  create(...args: Parameters<CrudInvitationsUseCase["create"]>): ReturnType<CrudInvitationsUseCase["create"]> {
    return this.CrudInvitationsUseCase.create(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  list(...args: Parameters<CrudInvitationsUseCase["list"]>): ReturnType<CrudInvitationsUseCase["list"]> {
    return this.CrudInvitationsUseCase.list(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  preview(...args: Parameters<PreviewInvitationUseCase["execute"]>): ReturnType<PreviewInvitationUseCase["execute"]> {
    return this.PreviewInvitationUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  accept(...args: Parameters<AcceptInvitationUseCase["execute"]>): ReturnType<AcceptInvitationUseCase["execute"]> {
    return this.AcceptInvitationUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  resend(...args: Parameters<ResendInvitationUseCase["execute"]>): ReturnType<ResendInvitationUseCase["execute"]> {
    return this.ResendInvitationUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  revoke(...args: Parameters<RevokeInvitationUseCase["execute"]>): ReturnType<RevokeInvitationUseCase["execute"]> {
    return this.RevokeInvitationUseCase.execute(...args);
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static providers(value: any) {
    return [
      { provide: InvitePatientInvitationUseCase, useValue: { execute: value.invitePatient } },
      { provide: InviteCollaboratorInvitationUseCase, useValue: { execute: value.inviteCollaborator } },
      { provide: CollaboratorRolesInvitationUseCase, useValue: { execute: value.collaboratorRoles } },
      { provide: CrudInvitationsUseCase, useValue: value },
      { provide: PreviewInvitationUseCase, useValue: { execute: value.preview } },
      { provide: AcceptInvitationUseCase, useValue: { execute: value.accept } },
      { provide: ResendInvitationUseCase, useValue: { execute: value.resend } },
      { provide: RevokeInvitationUseCase, useValue: { execute: value.revoke } }
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
      invitePatient: (...args: Parameters<InvitePatientInvitationUseCase["execute"]>) =>
        app.get(InvitePatientInvitationUseCase).execute(...args),
      inviteCollaborator: (...args: Parameters<InviteCollaboratorInvitationUseCase["execute"]>) =>
        app.get(InviteCollaboratorInvitationUseCase).execute(...args),
      collaboratorRoles: (...args: Parameters<CollaboratorRolesInvitationUseCase["execute"]>) =>
        app.get(CollaboratorRolesInvitationUseCase).execute(...args),
      create: (...args: Parameters<CrudInvitationsUseCase["create"]>) =>
        app.get(CrudInvitationsUseCase).create(...args),
      list: (...args: Parameters<CrudInvitationsUseCase["list"]>) => app.get(CrudInvitationsUseCase).list(...args),
      preview: (...args: Parameters<PreviewInvitationUseCase["execute"]>) =>
        app.get(PreviewInvitationUseCase).execute(...args),
      accept: (...args: Parameters<AcceptInvitationUseCase["execute"]>) =>
        app.get(AcceptInvitationUseCase).execute(...args),
      resend: (...args: Parameters<ResendInvitationUseCase["execute"]>) =>
        app.get(ResendInvitationUseCase).execute(...args),
      revoke: (...args: Parameters<RevokeInvitationUseCase["execute"]>) =>
        app.get(RevokeInvitationUseCase).execute(...args)
    };
  }
}

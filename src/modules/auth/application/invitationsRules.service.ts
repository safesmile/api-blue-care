import { PermissionCode } from "../../../shared/domain/permission-code";
import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Invitation, type InvitationActor } from "../domain/invitation.entity";
import { InvitationRepository } from "../domain/invitation.repository";
import { AccountMailer } from "../domain/account-actions.repository";
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
/** Reglas internas compartidas; no es una fachada de casos de uso. */
@Injectable()
export class InvitationsRules {
  /**
   * Recibe los puertos de negocio.
   * @param invitations Puerto tipado.
   * @param mail Puerto tipado.
   */
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly mail: AccountMailer
  ) {}
  /**
   * Regla interna compartida.
   * @param roles Entrada tipada de negocio.
   * @param actor Entrada tipada de negocio.
   */
  authorizeRoles(roles: string[], actor: InvitationActor) {
    if (
      !actor.permissions.includes(PermissionCode.RolesAssign) ||
      (roles.includes("superadmin") && !actor.roles.includes("superadmin"))
    )
      throw new ForbiddenException("No tiene autorización para asignar estos roles");
  }
  /**
   * Regla interna compartida.
   * @param actor Entrada tipada de negocio.
   */
  authorizePatient(actor: InvitationActor) {
    if (
      !actor.permissions.includes(PermissionCode.InvitationsCreate) ||
      !actor.permissions.includes(PermissionCode.PatientsLink)
    )
      throw new ForbiddenException("No tiene permiso para invitar pacientes");
  }
  /**
   * Regla interna compartida.
   * @param id Entrada tipada de negocio.
   * @returns Resultado de negocio.
   */
  async requireInvitation(id: string) {
    const invitation = await this.invitations.read(id);
    if (!invitation) throw new NotFoundException("No se encontró la invitación");
    return invitation;
  }
  /**
   * Regla interna compartida.
   * @param token Entrada tipada de negocio.
   * @returns Resultado de negocio.
   */
  async validToken(token: string) {
    const invitation = await this.invitations.findByToken(digest(token));
    if (!invitation) throw new NotFoundException("No se encontró la invitación");
    if (invitation.status() !== "pending") throw new GoneException("La invitación ya no es válida");
    return invitation;
  }
  /**
   * Regla interna compartida.
   * @param invitation Entrada tipada de negocio.
   * @param token Entrada tipada de negocio.
   */
  async deliver(invitation: Invitation, token: string) {
    try {
      await this.mail.send(invitation.props.email, "invite", token, {
        firstName: invitation.props.firstName,
        lastName: invitation.props.lastName,
        invitedByName: invitation.props.invitedByName,
        expiresAt: invitation.props.expiresAt
      });
    } catch {
      await this.invitations.delivery(invitation.id, digest(token), false);
      throw new ServiceUnavailableException(
        "La invitación se guardó, pero no se pudo enviar el correo; reenvíela desde el listado de invitaciones"
      );
    }
    await this.invitations.delivery(invitation.id, digest(token), true);
  }
}

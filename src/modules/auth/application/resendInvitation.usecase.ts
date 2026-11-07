import type { InvitationStatus } from "../domain/invitation.entity";
import { InvitationsRules } from "./invitationsRules.service";
import type { ClinicRoleAssignment } from "../../authorization/domain/clinic-context.repository";
import { RolesRepository } from "../../authorization/domain/roles.repository";
import { ConflictException, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { type InvitationActor, type InvitationKind } from "../domain/invitation.entity";
import { InvitationRepository } from "../domain/invitation.repository";
import type { RoleName } from "../../../permissions";
import { EntityUseCase } from "../../../shared/application/entity.usecase";
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export interface CreateInvitationInput {
  kind?: InvitationKind;
  clinicAssignments?: ClinicRoleAssignment[];
  staff?: boolean;
  patientId?: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleName[];
}
/** Caso de uso específico de Invitation. */
@Injectable()
export class ResendInvitationUseCase extends EntityUseCase<
  [id: string, actor: InvitationActor],
  Promise<{
    id: string;
    kind: InvitationKind;
    staff: boolean;
    patientId: string | null;
    clinicAssignments: ClinicRoleAssignment[];
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    invitedBy: string | null;
    invitedByName: string;
    invitedByEmail: string;
    createdAt: Date;
    expiresAt: Date;
    acceptedAt: Date | null;
    acceptedUserId: string | null;
    lastSendAttemptAt: Date | null;
    lastSentAt: Date | null;
    deliveryStatus: "pending" | "sent" | "failed";
    status: InvitationStatus;
  }>
> {
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param invitations Dependencia tipada de invitations.
   * @param roles Dependencia tipada de roles.
   * @param rules Dependencia tipada de rules.
   */
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly roles: RolesRepository,
    private readonly rules: InvitationsRules
  ) {
    super();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async perform(id: string, actor: InvitationActor) {
    const invitation = await this.rules.requireInvitation(id);
    if (invitation.props.kind === "patient") this.rules.authorizePatient(actor);
    else {
      this.rules.authorizeRoles(invitation.props.roles, actor);
      await this.roles.authorizeAssignment(invitation.props.roles, actor);
    }
    const token = randomBytes(40).toString("hex");
    if (!(await this.invitations.rotate(id, digest(token), new Date(Date.now() + 86400000), actor)))
      throw new ConflictException("La invitación no puede reenviarse: está cerrada o se envió hace menos de un minuto");
    await this.rules.deliver(await this.rules.requireInvitation(id), token);
    return (await this.rules.requireInvitation(id)).toView();
  }
}

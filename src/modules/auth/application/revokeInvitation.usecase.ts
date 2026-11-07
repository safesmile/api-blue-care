import { InvitationsRules } from "./invitationsRules.service";
import type { ClinicRoleAssignment } from "../../authorization/domain/clinic-context.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
import { ConflictException, Injectable } from "@nestjs/common";
import { type InvitationKind } from "../domain/invitation.entity";
import { InvitationRepository } from "../domain/invitation.repository";
import type { RoleName } from "../../../permissions";
import { EntityUseCase } from "../../../shared/application/entity.usecase";
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
export class RevokeInvitationUseCase extends EntityUseCase<[id: string, actor?: AccessActor], Promise<void>> {
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param invitations Dependencia tipada de invitations.
   * @param rules Dependencia tipada de rules.
   */
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly rules: InvitationsRules
  ) {
    super();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param actor Entrada de la operación.
   */
  protected async perform(id: string, actor?: AccessActor) {
    await this.rules.requireInvitation(id);
    if (!(await this.invitations.revoke(id, actor))) throw new ConflictException("La invitación ya está cerrada");
  }
}

import type { RoleView } from "../../authorization/domain/roles.repository";
import { InvitationsRules } from "./invitationsRules.service";
import type { ClinicRoleAssignment } from "../../authorization/domain/clinic-context.repository";
import { RolesRepository } from "../../authorization/domain/roles.repository";
import { Injectable } from "@nestjs/common";
import { type InvitationActor, type InvitationKind } from "../domain/invitation.entity";
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
export class CollaboratorRolesInvitationUseCase extends EntityUseCase<
  [clinicId: string, actor: InvitationActor],
  Promise<RoleView[]>
> {
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param roles Dependencia tipada de roles.
   * @param rules Dependencia tipada de rules.
   */
  constructor(
    private readonly roles: RolesRepository,
    private readonly rules: InvitationsRules
  ) {
    super();
  }
  /**
   *
   * @param clinicId Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async perform(clinicId: string, actor: InvitationActor) {
    this.rules.authorizeRoles(["staff"], actor);
    return this.roles.clinicAssignable(clinicId, actor);
  }
}

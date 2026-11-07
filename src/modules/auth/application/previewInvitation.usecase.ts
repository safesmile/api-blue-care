import type { InvitationStatus } from "../domain/invitation.entity";
import { InvitationsRules } from "./invitationsRules.service";
import type { ClinicRoleAssignment } from "../../authorization/domain/clinic-context.repository";
import { Injectable } from "@nestjs/common";
import { type InvitationKind } from "../domain/invitation.entity";
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
export class PreviewInvitationUseCase extends EntityUseCase<
  [token: string],
  Promise<{
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    expiresAt: Date;
    status: InvitationStatus;
  }>
> {
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param rules Dependencia tipada de rules.
   */
  constructor(private readonly rules: InvitationsRules) {
    super();
  }
  /**
   *
   * @param token Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async perform(token: string) {
    return (await this.rules.validToken(token)).preview();
  }
}

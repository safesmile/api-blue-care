import { InvitationsRules } from "./invitationsRules.service";
import type { ClinicRoleAssignment } from "../../authorization/domain/clinic-context.repository";
import { GoneException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { type InvitationKind } from "../domain/invitation.entity";
import { InvitationRepository } from "../domain/invitation.repository";
import { PasswordHasher } from "../../identity/domain/password-hasher";
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
export class AcceptInvitationUseCase extends EntityUseCase<[token: string, password: string], Promise<void>> {
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param invitations Dependencia tipada de invitations.
   * @param passwords Dependencia tipada de passwords.
   * @param rules Dependencia tipada de rules.
   */
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly passwords: PasswordHasher,
    private readonly rules: InvitationsRules
  ) {
    super();
  }
  /**
   *
   * @param token Entrada de la operación.
   * @param password Entrada de la operación.
   */
  protected async perform(token: string, password: string) {
    await this.rules.validToken(token);
    if (!(await this.invitations.accept(digest(token), await this.passwords.hash(password))))
      throw new GoneException("La invitación ya no es válida");
  }
}

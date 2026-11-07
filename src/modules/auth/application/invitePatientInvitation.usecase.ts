import type { InvitationStatus } from "../domain/invitation.entity";
import type { ClinicRoleAssignment } from "../../authorization/domain/clinic-context.repository";
import { BadRequestException, Injectable } from "@nestjs/common";
import { type InvitationActor, type InvitationKind } from "../domain/invitation.entity";
import type { RoleName } from "../../../permissions";
import { EntityUseCase } from "../../../shared/application/entity.usecase";
import { CrudInvitationsUseCase } from "./crudInvitations.usecase";
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
export class InvitePatientInvitationUseCase extends EntityUseCase<
  [input: Omit<CreateInvitationInput, "roles" | "staff" | "kind" | "clinicAssignments">, actor: InvitationActor],
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
  /**
   * Recibe las dependencias de la operación.
   * @param createOperation Dependencia tipada de createOperation.
   */
  constructor(private readonly createOperation: CrudInvitationsUseCase) {
    super();
  }
  /**
   *
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(
    input: Omit<CreateInvitationInput, "roles" | "staff" | "kind" | "clinicAssignments">,
    actor: InvitationActor
  ) {
    if (!actor.clinicId) throw new BadRequestException("Seleccione una clínica antes de invitar a un paciente");
    return this.createOperation.create(
      { ...input, roles: ["customer"], staff: false, clinicAssignments: [], kind: "patient" },
      actor
    );
  }
}

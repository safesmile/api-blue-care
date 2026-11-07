import type { MembershipView } from "../domain/membership.repository";
import { MembershipsRules } from "./membershipsRules.service";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable, NotFoundException } from "@nestjs/common";
import { MembershipRepository, type MembershipInput } from "../domain/membership.repository";
import { PatientRepository } from "../../patients/domain/patient.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Membership. */
@Injectable()
export class CreateOwnMembershipUseCase extends EntityUseCase<
  [input: Omit<MembershipInput, "patientId">, actor: AccessActor],
  Promise<MembershipView>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 1, permissions: [PermissionCode.MembershipsSelf] };

  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param memberships Dependencia tipada de memberships.
   * @param patients Dependencia tipada de patients.
   * @param rules Dependencia tipada de rules.
   */
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly patients: PatientRepository,
    private readonly rules: MembershipsRules
  ) {
    super();
  }
  /**
   *
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async perform(input: Omit<MembershipInput, "patientId">, actor: AccessActor) {
    this.rules.validate(input.cadence);
    const patient = await this.patients.own(actor.id);
    if (!patient) throw new NotFoundException("No hay un paciente vinculado a esta cuenta");
    return this.memberships.create({ ...input, patientId: patient.id }, actor, true);
  }
}

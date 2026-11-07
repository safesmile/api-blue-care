import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { ClinicRepository } from "../domain/clinic.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Clinic. */
@Injectable()
export class AssignClinicUseCase extends EntityUseCase<
  [id: string, userId: string, actor: AccessActor, roles: string[]],
  Promise<void>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 2, permissions: [PermissionCode.ClinicsStaffManage] };

  /**
   * Recibe las dependencias de la operación.
   * @param clinics Dependencia tipada de clinics.
   */
  constructor(private readonly clinics: ClinicRepository) {
    super();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param userId Entrada de la operación.
   * @param actor Entrada de la operación.
   * @param roles Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, userId: string, actor: AccessActor, roles: string[]) {
    return this.clinics.assign(id, userId, actor, roles);
  }
}

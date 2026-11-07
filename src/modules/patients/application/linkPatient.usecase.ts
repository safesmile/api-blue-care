import type { PatientView } from "../domain/patient.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { PatientRepository } from "../domain/patient.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Patient. */
@Injectable()
export class LinkPatientUseCase extends EntityUseCase<
  [id: string, userId: string, actor: AccessActor],
  Promise<PatientView>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 2, permissions: [PermissionCode.PatientsLink] };

  /**
   * Recibe las dependencias de la operación.
   * @param patients Dependencia tipada de patients.
   */
  constructor(private readonly patients: PatientRepository) {
    super();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param userId Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, userId: string, actor: AccessActor) {
    return this.patients.link(id, userId, actor);
  }
}

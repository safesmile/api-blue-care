import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { PatientRepository } from "../domain/patient.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Patient. */
@Injectable()
export class ClinicsPatientUseCase extends EntityUseCase<[id: string, actor: AccessActor], Promise<string[]>> {
  protected readonly policy: OperationPolicy = { actorIndex: 1, permissions: [PermissionCode.PatientsRead] };

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
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, actor: AccessActor) {
    return this.patients.clinics(id, actor);
  }
}

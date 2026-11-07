import type { PatientView } from "../domain/patient.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PatientRepository } from "../domain/patient.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Patient. */
@Injectable()
export class OwnPatientUseCase extends EntityUseCase<[actor: AccessActor], Promise<PatientView>> {
  protected readonly policy: OperationPolicy = { actorIndex: 0, permissions: [PermissionCode.PatientsSelf] };

  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param patients Dependencia tipada de patients.
   */
  constructor(private readonly patients: PatientRepository) {
    super();
  }
  /**
   *
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async perform(actor: AccessActor) {
    const patient = await this.patients.own(actor.id);
    if (!patient) throw new NotFoundException("No hay un paciente vinculado a esta cuenta");
    return patient;
  }
}

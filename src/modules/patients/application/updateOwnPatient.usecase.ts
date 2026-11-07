import type { PatientView } from "../domain/patient.repository";
import { PatientsRules } from "./patientsRules.service";
import { Injectable } from "@nestjs/common";
import { PatientRepository, type PatientInput } from "../domain/patient.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase } from "../../../shared/application/entity.usecase";
import { OwnPatientUseCase } from "./ownPatient.usecase";

/** Caso de uso específico de Patient. */
@Injectable()
export class UpdateOwnPatientUseCase extends EntityUseCase<
  [input: Pick<PatientInput, "phone" | "birthDate" | "address">, actor: AccessActor],
  Promise<PatientView>
> {
  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param patients Dependencia tipada de patients.
   * @param ownOperation Dependencia tipada de ownOperation.
   * @param rules Dependencia tipada de rules.
   */
  constructor(
    private readonly patients: PatientRepository,
    private readonly ownOperation: OwnPatientUseCase,
    private readonly rules: PatientsRules
  ) {
    super();
  }
  /**
   *
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async perform(input: Pick<PatientInput, "phone" | "birthDate" | "address">, actor: AccessActor) {
    await this.ownOperation.execute(actor);
    this.rules.validate(input);
    return this.patients.updateOwn(
      actor.id,
      { phone: input.phone, birthDate: input.birthDate, address: input.address },
      actor
    );
  }
}

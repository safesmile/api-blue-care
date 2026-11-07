import { BadRequestException, Injectable } from "@nestjs/common";
import { type BeneficiaryInput } from "../domain/benefit-operations.repository";
import { personName } from "../../../shared/domain/person-name";
import { validBeneficiaryDate } from "../domain/beneficiary-date";

/** Reglas internas compartidas; no es una fachada de casos de uso. */
@Injectable()
export class BenefitOperationsRules {
  /**
   * Regla interna compartida.
   * @param value Entrada tipada de negocio.
   */
  units(value: number) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 1000)
      throw new BadRequestException("Las unidades deben ser un número entero entre 1 y 1000");
  }
  /**
   * Regla interna compartida.
   * @param input Entrada tipada de negocio.
   * @returns Resultado de negocio.
   */
  familyInput(input: BeneficiaryInput): BeneficiaryInput {
    const profile = personName(input.firstName, input.lastName);
    if (!profile) throw new BadRequestException("El nombre del beneficiario no es válido");
    if (!validBeneficiaryDate(input.birthDate))
      throw new BadRequestException("La fecha de nacimiento del beneficiario no es válida");
    return { firstName: profile.firstName, lastName: profile.lastName, birthDate: input.birthDate ?? null };
  }
}

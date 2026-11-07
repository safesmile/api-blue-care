import { BadRequestException, Injectable } from "@nestjs/common";
import { type PatientInput } from "../domain/patient.repository";
import { personName } from "../../../shared/domain/person-name";

/** Reglas internas compartidas; no es una fachada de casos de uso. */
@Injectable()
export class PatientsRules {
  /**
   * Regla interna compartida.
   * @param input Entrada tipada de negocio.
   */
  validate(input: Partial<PatientInput>) {
    if (input.firstName !== undefined && input.lastName !== undefined && !personName(input.firstName, input.lastName))
      throw new BadRequestException("El nombre del paciente no es válido");
    if (
      input.birthDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate) ||
        input.birthDate.startsWith("0000-") ||
        !Number.isFinite(Date.parse(input.birthDate)) ||
        new Date(input.birthDate).toISOString().slice(0, 10) !== input.birthDate ||
        input.birthDate > new Date().toISOString().slice(0, 10))
    )
      throw new BadRequestException("La fecha de nacimiento debe ser válida y no puede estar en el futuro");
  }
}

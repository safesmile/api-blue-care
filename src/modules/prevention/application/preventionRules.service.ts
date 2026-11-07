import { BadRequestException, Injectable } from "@nestjs/common";
import { type EventInput, type EventUpdate } from "../domain/prevention.repository";

/** Reglas internas compartidas; no es una fachada de casos de uso. */
@Injectable()
export class PreventionRules {
  /**
   * Regla interna compartida.
   * @param input Entrada tipada de negocio.
   */
  validate(input: EventInput | EventUpdate) {
    if (
      input.intervalMonths !== null &&
      (!Number.isInteger(input.intervalMonths) || input.intervalMonths < 1 || input.intervalMonths > 120)
    )
      throw new BadRequestException("Debe seleccionar explícitamente el intervalo de prevención de este paciente");
    if (
      input.reminderHours.length > 10 ||
      new Set(input.reminderHours).size !== input.reminderHours.length ||
      input.reminderHours.some(n => !Number.isInteger(n) || n < 1 || n > 8760)
    )
      throw new BadRequestException("Los plazos de los recordatorios no son válidos");
  }
}

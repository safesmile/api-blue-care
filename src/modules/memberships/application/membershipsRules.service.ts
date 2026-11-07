import { BadRequestException, Injectable } from "@nestjs/common";

/** Reglas internas compartidas; no es una fachada de casos de uso. */
@Injectable()
export class MembershipsRules {
  /**
   * Regla interna compartida.
   * @param cadence Entrada tipada de negocio.
   */
  validate(cadence: string) {
    if (!["monthly", "annual"].includes(cadence)) throw new BadRequestException("La frecuencia de cobro no es válida");
  }
}

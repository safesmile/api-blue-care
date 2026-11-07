import { Injectable } from "@nestjs/common";
import { PreventionRepository } from "../domain/prevention.repository";
import { EntityUseCase } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de PreventionEvent. */
@Injectable()
export class DrainPreventionEventUseCase extends EntityUseCase<[], Promise<{ generated: number }>> {
  /**
   * Recibe las dependencias de la operación.
   * @param repository Dependencia tipada de repository.
   */
  constructor(private readonly repository: PreventionRepository) {
    super();
  }
  /**
   *
   * @returns Resultado de la operación.
   */
  protected perform() {
    return this.repository.drain();
  }
}

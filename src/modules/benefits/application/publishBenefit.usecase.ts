import type { BenefitView } from "../domain/benefit.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { BenefitRepository } from "../domain/benefit.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Benefit. */
@Injectable()
export class PublishBenefitUseCase extends EntityUseCase<
  [id: string, versionId: string, actor: AccessActor],
  Promise<BenefitView>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 2, permissions: [PermissionCode.BenefitsPublish] };

  /**
   * Recibe las dependencias de la operación.
   * @param benefits Dependencia tipada de benefits.
   */
  constructor(private readonly benefits: BenefitRepository) {
    super();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param versionId Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, versionId: string, actor: AccessActor) {
    return this.benefits.publish(id, versionId, actor);
  }
}

import type { BenefitVersion } from "../domain/benefit.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { BadRequestException, Injectable } from "@nestjs/common";
import { BenefitRepository, type BenefitVersionInput } from "../domain/benefit.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Benefit. */
@Injectable()
export class VersionBenefitUseCase extends EntityUseCase<
  [id: string, input: BenefitVersionInput, actor: AccessActor],
  Promise<BenefitVersion>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 2, permissions: [PermissionCode.BenefitsVersion] };

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
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, input: BenefitVersionInput, actor: AccessActor) {
    if (!Number.isSafeInteger(input.limitUnits) || input.limitUnits < 1 || input.limitUnits > 100000)
      throw new BadRequestException("El límite de usos no es válido");
    if (
      input.discountBasisPoints !== undefined &&
      input.discountBasisPoints !== null &&
      (!Number.isSafeInteger(input.discountBasisPoints) ||
        input.discountBasisPoints < 1 ||
        input.discountBasisPoints > 10000)
    )
      throw new BadRequestException("Los puntos básicos del descuento no son válidos");
    return this.benefits.version(id, input, actor);
  }
}

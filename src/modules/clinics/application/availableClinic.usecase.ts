import type { ClinicView } from "../domain/clinic.repository";
import type { Page } from "../../../shared/domain/crud.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { ClinicRepository, type ClinicQuery } from "../domain/clinic.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Clinic. */
@Injectable()
export class AvailableClinicUseCase extends EntityUseCase<
  [query: ClinicQuery, actor: AccessActor],
  Promise<Page<ClinicView>>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 1, permissions: [PermissionCode.ClinicsStaffManage] };

  /**
   * Recibe las dependencias de la operación.
   * @param clinics Dependencia tipada de clinics.
   */
  constructor(private readonly clinics: ClinicRepository) {
    super();
  }
  /**
   *
   * @param query Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(query: ClinicQuery, actor: AccessActor) {
    return this.clinics.available(query, actor);
  }
}

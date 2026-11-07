import type { ClinicStaffView } from "../domain/clinic.repository";
import type { Page } from "../../../shared/domain/crud.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable } from "@nestjs/common";
import { ClinicRepository } from "../domain/clinic.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de Clinic. */
@Injectable()
export class StaffClinicUseCase extends EntityUseCase<
  [id: string, page: Pagination, actor: AccessActor],
  Promise<Page<ClinicStaffView>>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 2, permissions: [PermissionCode.ClinicsStaffList] };

  /**
   * Recibe las dependencias de la operación.
   * @param clinics Dependencia tipada de clinics.
   */
  constructor(private readonly clinics: ClinicRepository) {
    super();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param page Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected perform(id: string, page: Pagination, actor: AccessActor) {
    return this.clinics.staff(id, page, actor);
  }
}

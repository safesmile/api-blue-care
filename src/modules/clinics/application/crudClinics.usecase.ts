import type { Page } from "../../../shared/domain/crud.repository";
import type { ClinicView } from "../domain/clinic.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable, NotFoundException } from "@nestjs/common";
import { ClinicRepository, type ClinicInput, type ClinicQuery } from "../domain/clinic.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { CrudEntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";
interface CrudClinicsUseCaseOperations {
  create: (input: ClinicInput, actor: AccessActor) => Promise<ClinicView>;
  read: (id: string, actor: AccessActor) => Promise<ClinicView>;
  list: (query: ClinicQuery, actor: AccessActor) => Promise<Page<ClinicView>>;
  update: (id: string, input: Partial<ClinicInput> & { enabled?: boolean }, actor: AccessActor) => Promise<ClinicView>;
}

/** Operaciones CRUD de Clinic. */
@Injectable()
export class CrudClinicsUseCase extends CrudEntityUseCase<CrudClinicsUseCaseOperations> {
  protected readonly asynchronousActions = ["read"];

  protected readonly handlers = {
    create: this.createEntity.bind(this),
    read: this.readEntity.bind(this),
    list: this.listEntity.bind(this),
    update: this.updateEntity.bind(this)
  };
  protected readonly policies: Partial<Record<keyof CrudClinicsUseCaseOperations, OperationPolicy>> = {
    create: { actorIndex: 1, permissions: [PermissionCode.ClinicsCreate, PermissionCode.ClinicsAll] },
    read: { actorIndex: 1, permissions: [PermissionCode.ClinicsRead] },
    list: { actorIndex: 1, permissions: [PermissionCode.ClinicsList] },
    update: { actorIndex: 2, permissions: [PermissionCode.ClinicsUpdate] }
  };

  /**
   * Recibe las dependencias de la operación.
   * @param clinics Dependencia tipada de clinics.
   */
  constructor(private readonly clinics: ClinicRepository) {
    super();
  }
  /**
   *
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected createEntity(input: ClinicInput, actor: AccessActor) {
    return this.clinics.create(input, actor);
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async readEntity(id: string, actor: AccessActor) {
    const clinic = await this.clinics.read(id, actor);
    if (!clinic) throw new NotFoundException("No se encontró la clínica");
    return clinic;
  }
  /**
   *
   * @param query Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected listEntity(query: ClinicQuery, actor: AccessActor) {
    return this.clinics.list(query, actor);
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected updateEntity(id: string, input: Partial<ClinicInput> & { enabled?: boolean }, actor: AccessActor) {
    return this.clinics.update(id, input, actor);
  }
}

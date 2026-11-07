import type { Page } from "../../../shared/domain/crud.repository";
import type { PatientView } from "../domain/patient.repository";
import { PatientsRules } from "./patientsRules.service";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PatientRepository, type PatientInput, type PatientQuery } from "../domain/patient.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { CrudEntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";
interface CrudPatientsUseCaseOperations {
  create: (input: PatientInput & { clinicId: string }, actor: AccessActor) => Promise<PatientView>;
  read: (id: string, actor: AccessActor) => Promise<PatientView>;
  list: (query: PatientQuery, actor: AccessActor) => Promise<Page<PatientView>>;
  update: (
    id: string,
    input: Partial<PatientInput> & { enabled?: boolean },
    actor: AccessActor
  ) => Promise<PatientView>;
}

/** Operaciones CRUD de Patient. */
@Injectable()
export class CrudPatientsUseCase extends CrudEntityUseCase<CrudPatientsUseCaseOperations> {
  protected readonly asynchronousActions = ["read"];

  protected readonly handlers = {
    create: this.createEntity.bind(this),
    read: this.readEntity.bind(this),
    list: this.listEntity.bind(this),
    update: this.updateEntity.bind(this)
  };
  protected readonly policies: Partial<Record<keyof CrudPatientsUseCaseOperations, OperationPolicy>> = {
    create: { actorIndex: 1, permissions: [PermissionCode.PatientsCreate] },
    read: { actorIndex: 1, permissions: [PermissionCode.PatientsRead] },
    list: { actorIndex: 1, permissions: [PermissionCode.PatientsList] },
    update: { actorIndex: 2, permissions: [PermissionCode.PatientsUpdate] }
  };

  /**
   * Recibe las dependencias de la operación.
   * @param patients Dependencia tipada de patients.
   * @param rules Dependencia tipada de rules.
   */
  constructor(
    private readonly patients: PatientRepository,
    private readonly rules: PatientsRules
  ) {
    super();
  }
  /**
   *
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected createEntity(input: PatientInput & { clinicId: string }, actor: AccessActor) {
    this.rules.validate(input);
    return this.patients.create(input, actor);
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async readEntity(id: string, actor: AccessActor) {
    const patient = await this.patients.read(id, actor);
    if (!patient) throw new NotFoundException("No se encontró el paciente");
    return patient;
  }
  /**
   *
   * @param query Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected listEntity(query: PatientQuery, actor: AccessActor) {
    return this.patients.list(query, actor);
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected updateEntity(id: string, input: Partial<PatientInput> & { enabled?: boolean }, actor: AccessActor) {
    this.rules.validate(input);
    return this.patients.update(id, input, actor);
  }
}

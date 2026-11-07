import type { AuditRecord } from "../domain/audit.repository";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditRepository, type AuditQuery } from "../domain/audit.repository";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { CrudEntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";
interface CrudAuditUseCaseOperations {
  list: (query: AuditQuery, actor: AccessActor) => Promise<{ items: AuditRecord[]; total: number }>;
  read: (id: string, actor: AccessActor) => Promise<AuditRecord>;
}

/** Operaciones CRUD de AuditRecord. */
@Injectable()
export class CrudAuditUseCase extends CrudEntityUseCase<CrudAuditUseCaseOperations> {
  protected readonly asynchronousActions = ["read"];

  protected readonly handlers = { list: this.listEntity.bind(this), read: this.readEntity.bind(this) };
  protected readonly policies: Partial<Record<keyof CrudAuditUseCaseOperations, OperationPolicy>> = {
    list: { actorIndex: 1, permissions: [PermissionCode.AuditList] },
    read: { actorIndex: 1, permissions: [PermissionCode.AuditRead] }
  };

  /**
   * Recibe las dependencias de la operación.
   * @param records Dependencia tipada de records.
   */
  constructor(private readonly records: AuditRepository) {
    super();
  }
  /**
   *
   * @param query Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected listEntity(query: AuditQuery, actor: AccessActor) {
    if (query.from && query.to && new Date(query.from) > new Date(query.to))
      throw new BadRequestException("El rango de fechas no es válido");
    return this.records.list(query, actor);
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async readEntity(id: string, actor: AccessActor) {
    const record = await this.records.read(id, actor);
    if (!record) throw new NotFoundException("No se encontró el registro de auditoría");
    return record;
  }
}

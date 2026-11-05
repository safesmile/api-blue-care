import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditRepository, type AuditQuery } from "../domain/audit.repository";
import { AccessPolicy, type AccessActor } from "../../authorization/domain/access-policy";
/** Explicit privileged read operations; no write/update/delete API exists for audit records. */
@Injectable()
export class AuditUseCase {
  /**
   *
   * @param records Read-only audit persistence.
   */
  constructor(private readonly records: AuditRepository) {}
  /**
   *
   * @param query Validated audit filters and bounded pagination.
   * @param actor Authenticated caller and effective grants.
   * @returns Result of the completed operation.
   */
  list(query: AuditQuery, actor: AccessActor) {
    if (!AccessPolicy.allows(actor, "audit:list")) throw new ForbiddenException();
    if (query.from && query.to && new Date(query.from) > new Date(query.to))
      throw new BadRequestException("Invalid date range");
    return this.records.list(query);
  }
  /**
   *
   * @param id Resource identifier.
   * @param actor Authenticated caller and effective grants.
   * @returns Result of the completed operation.
   */
  async read(id: string, actor: AccessActor) {
    if (!AccessPolicy.allows(actor, "audit:read")) throw new ForbiddenException();
    const record = await this.records.read(id);
    if (!record) throw new NotFoundException("Audit record not found");
    return record;
  }
}

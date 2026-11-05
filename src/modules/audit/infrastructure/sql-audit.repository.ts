import { Injectable } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes } from "sequelize";
import { AuditRepository, type AuditRecord, type AuditQuery } from "../domain/audit.repository";
/** Only fixed columns and parameterized values can participate in audit filtering. */
@Injectable()
export class SqlAuditRepository extends AuditRepository {
  /**
   *
   * @param db PostgreSQL connection.
   */
  constructor(private readonly db: Sequelize) {
    super();
  }
  /**
   *
   * @param query Validated audit filters and bounded pagination.
   * @returns Result of the completed operation.
   */
  async list(query: AuditQuery) {
    const conditions: string[] = [];
    for (const key of ["actorId", "action", "resourceType", "resourceId"] as const)
      if (query[key]) conditions.push('"' + key + '" = :' + key);
    if (query.from) conditions.push('"occurredAt" >= :from');
    if (query.to) conditions.push('"occurredAt" <= :to');
    const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
    const items = await this.db.query<AuditRecord>(
      "SELECT * FROM audit_events" + where + ' ORDER BY "occurredAt" DESC,id DESC LIMIT :limit OFFSET :offset',
      { replacements: { ...query }, type: QueryTypes.SELECT }
    );
    const [count] = await this.db.query<{ total: number }>("SELECT COUNT(*)::int AS total FROM audit_events" + where, {
      replacements: { ...query },
      type: QueryTypes.SELECT
    });
    return { items, total: count.total };
  }
  /**
   *
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  async read(id: string) {
    const [record] = await this.db.query<AuditRecord>("SELECT * FROM audit_events WHERE id=:id", {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    return record ?? null;
  }
}

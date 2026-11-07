import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, UniqueConstraintError } from "sequelize";
import { randomUUID } from "node:crypto";
import { PlanRepository, type PlanView, type PlanVersion, type PlanVersionInput } from "../domain/plan.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { recordChange } from "../../audit/infrastructure/record-change";
import { auditSnapshot } from "../../audit/domain/audit-snapshot";
const PLAN_SELECT =
  'SELECT p.*,to_jsonb(v) AS "currentVersion" FROM plans p LEFT JOIN plan_versions v ON v.id=p."currentVersionId"';
/** Stores immutable commercial revisions and a separately mutable publication pointer. */
@Injectable()
export class SqlPlanRepository extends PlanRepository {
  /**
   * Recibe las dependencias de la operación.
   * @param db Dependencia tipada de db.
   */
  constructor(private readonly db: Sequelize) {
    super();
  }
  /**
   * Creates an explicitly authorized pending record.
   * @param code Stable commercial code or required permission.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async create(code: string, actor: AccessActor) {
    const id = randomUUID();
    try {
      await this.db.transaction(async transaction => {
        await this.db.query(
          'INSERT INTO plans (id,code,enabled,"createdAt","updatedAt") VALUES (:id,:code,true,NOW(),NOW())',
          { replacements: { id, code }, transaction }
        );
        await recordChange(this.db, transaction, {
          action: "plan.created",
          resourceType: "plan",
          resourceId: id,
          actorId: actor.id,
          after: { id, code, enabled: true }
        });
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw new ConflictException("El código del plan ya existe");
      throw error;
    }
    return (await this.read(id))!;
  }
  /**
   * Reads one authorized resource without changing its state.
   * @param id Resource identifier.
   * @returns The persisted result or completion of the authorized operation.
   */
  async read(id: string) {
    const [row] = await this.db.query<PlanView>(PLAN_SELECT + " WHERE p.id=:id", {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    return row ?? null;
  }
  /**
   * Returns a bounded page within the caller scope.
   * @param page Bounded pagination values.
   * @param catalog Whether only currently contractible plans are returned.
   * @returns The persisted result or completion of the authorized operation.
   */
  async list(page: Pagination, catalog: boolean) {
    const filter = catalog ? ' WHERE p.enabled AND p."currentVersionId" IS NOT NULL' : "";
    const items = await this.db.query<PlanView>(
      PLAN_SELECT + filter + " ORDER BY p.code,p.id LIMIT :limit OFFSET :offset",
      { replacements: { ...page }, type: QueryTypes.SELECT }
    );
    const [count] = await this.db.query<{ total: number }>("SELECT COUNT(*)::int total FROM plans p" + filter, {
      type: QueryTypes.SELECT
    });
    return { items, total: count.total };
  }
  /**
   * Appends an immutable commercial revision.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async version(id: string, input: PlanVersionInput, actor: AccessActor) {
    return this.db.transaction(async transaction => {
      const [plan] = await this.db.query<PlanView>("SELECT * FROM plans WHERE id=:id FOR UPDATE", {
        replacements: { id },
        transaction,
        type: QueryTypes.SELECT
      });
      if (!plan) throw new NotFoundException("No se encontró el plan");
      const [next] = await this.db.query<{ number: number }>(
        'SELECT COALESCE(MAX(number),0)+1 AS number FROM plan_versions WHERE "planId"=:id',
        { replacements: { id }, transaction, type: QueryTypes.SELECT }
      );
      const [row] = await this.db.query<PlanVersion>(
        `INSERT INTO plan_versions (id,"planId",number,name,description,"benefitDescriptions","monthlyPriceCents","annualPriceCents",currency,"taxDisclosure","createdAt")
        VALUES (:versionId,:id,:number,:name,:description,CAST(:benefits AS JSONB),:monthly,:annual,'GTQ',:tax,NOW()) RETURNING *`,
        {
          replacements: {
            id,
            versionId: randomUUID(),
            number: next.number,
            name: input.name.trim(),
            description: input.description.trim(),
            benefits: JSON.stringify(input.benefitDescriptions),
            monthly: input.monthlyPriceCents,
            annual: input.monthlyPriceCents * 10,
            tax: input.taxDisclosure.trim()
          },
          transaction,
          type: QueryTypes.SELECT
        }
      );
      await recordChange(this.db, transaction, {
        action: "plan.version-created",
        resourceType: "plan",
        resourceId: id,
        actorId: actor.id,
        after: auditSnapshot(row, [
          "id",
          "number",
          "name",
          "description",
          "benefitDescriptions",
          "monthlyPriceCents",
          "annualPriceCents",
          "currency",
          "taxDisclosure"
        ])
      });
      return row;
    });
  }
  /**
   * Lists immutable commercial history.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @returns The persisted result or completion of the authorized operation.
   */
  async versions(id: string, page: Pagination) {
    if (!(await this.read(id))) throw new NotFoundException("No se encontró el plan");
    const items = await this.db.query<PlanVersion>(
      'SELECT * FROM plan_versions WHERE "planId"=:id ORDER BY number DESC LIMIT :limit OFFSET :offset',
      { replacements: { id, ...page }, type: QueryTypes.SELECT }
    );
    const [count] = await this.db.query<{ total: number }>(
      'SELECT COUNT(*)::int total FROM plan_versions WHERE "planId"=:id',
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    return { items, total: count.total };
  }
  /**
   * Publishes a new revision without rewriting existing contracts.
   * @param id Resource identifier.
   * @param versionId Immutable plan revision identifier.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async publish(id: string, versionId: string, actor: AccessActor) {
    await this.db.transaction(async transaction => {
      const [plan] = await this.db.query<PlanView>("SELECT * FROM plans WHERE id=:id FOR UPDATE", {
        replacements: { id },
        transaction,
        type: QueryTypes.SELECT
      });
      if (!plan) throw new NotFoundException("No se encontró el plan");
      if (plan.currentVersionId === versionId) return;
      const [version] = await this.db.query<PlanVersion>(
        'SELECT * FROM plan_versions WHERE id=:versionId AND "planId"=:id',
        { replacements: { id, versionId }, transaction, type: QueryTypes.SELECT }
      );
      if (!version) throw new NotFoundException("La versión no pertenece a este plan");
      if (version.publishedAt)
        throw new ConflictException("Cree una nueva versión; no se pueden volver a publicar condiciones históricas");
      await this.db.query('UPDATE plan_versions SET "publishedAt"=NOW() WHERE id=:versionId', {
        replacements: { versionId },
        transaction
      });
      await this.db.query('UPDATE plans SET "currentVersionId"=:versionId,"updatedAt"=NOW() WHERE id=:id', {
        replacements: { id, versionId },
        transaction
      });
      await recordChange(this.db, transaction, {
        action: "plan.published",
        resourceType: "plan",
        resourceId: id,
        actorId: actor.id,
        before: { currentVersionId: plan.currentVersionId },
        after: { currentVersionId: versionId, number: version.number }
      });
    });
    return (await this.read(id))!;
  }
  /**
   * Changes whether a plan accepts new contracts.
   * @param id Resource identifier.
   * @param enabled Whether the plan accepts new contracts.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async update(id: string, enabled: boolean, actor: AccessActor) {
    await this.db.transaction(async transaction => {
      const [before] = await this.db.query<PlanView>("SELECT * FROM plans WHERE id=:id FOR UPDATE", {
        replacements: { id },
        transaction,
        type: QueryTypes.SELECT
      });
      if (!before) throw new NotFoundException("No se encontró el plan");
      if (before.enabled === enabled) return;
      await this.db.query('UPDATE plans SET enabled=:enabled,"updatedAt"=NOW() WHERE id=:id', {
        replacements: { id, enabled },
        transaction
      });
      await recordChange(this.db, transaction, {
        action: "plan.updated",
        resourceType: "plan",
        resourceId: id,
        actorId: actor.id,
        before: { enabled: before.enabled },
        after: { enabled }
      });
    });
    return (await this.read(id))!;
  }
}

import { sqlListQuery } from "../../../shared/infrastructure/sql-list-query";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, UniqueConstraintError } from "sequelize";
import { randomUUID } from "node:crypto";
import { PlanRepository, type PlanView, type PlanVersion, type PlanVersionInput } from "../domain/plan.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { recordChange } from "../../audit/infrastructure/record-change";
import { auditSnapshot } from "../../audit/domain/audit-snapshot";
const PLAN_FROM = ' FROM plans p LEFT JOIN plan_versions v ON v.id=p."currentVersionId"';
const BENEFIT_SUMMARY = `COALESCE((
  SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
    'id', b.id, 'code', b.code, 'name', bv.name, 'description', bv.description,
    'enabled', bv.enabled, 'kind', b.kind, 'period', b.period, 'audience', b.audience,
    'limitUnits', bv."limitUnits", 'discountBasisPoints', bv."discountBasisPoints"
  ) ORDER BY COALESCE(bv.name,b.code),b.id)
  FROM benefit_definitions b LEFT JOIN benefit_versions bv ON bv.id=b."currentVersionId"`;
const PLAN_BENEFITS =
  BENEFIT_SUMMARY +
  `
  JOIN plan_benefits pb ON b.id=pb."benefitId"
  WHERE pb."planId"=p.id AND (NOT :catalog OR bv.enabled)
), '[]'::jsonb) AS "benefits"`;
const ADMIN_DETAILS =
  ', to_jsonb(draft) AS "latestDraft", COALESCE(family."maxBeneficiaries",4) AS "maxBeneficiaries", ' +
  BENEFIT_SUMMARY +
  ` WHERE b.id=ANY(draft."benefitIds")
), '[]'::jsonb) AS "draftBenefits"`;
const ADMIN_FROM = ` LEFT JOIN plan_family_settings family ON family."planId"=p.id
  LEFT JOIN LATERAL (
    SELECT * FROM plan_versions d WHERE d."planId"=p.id AND d."publishedAt" IS NULL
      AND d.number>COALESCE(v.number,0) ORDER BY d.number DESC LIMIT 1
  ) draft ON TRUE`;
const PLAN_SELECT = 'SELECT p.*,to_jsonb(v) AS "currentVersion", ' + PLAN_BENEFITS;
const ADMIN_SELECT = PLAN_SELECT + ADMIN_DETAILS + PLAN_FROM + ADMIN_FROM;
/** Stores commercial revisions and a separately mutable publication pointer. */
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
    const [row] = await this.db.query<PlanView>(ADMIN_SELECT + " WHERE p.id=:id", {
      replacements: { id, catalog: false },
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
    const listing = sqlListQuery(
      page,
      {
        id: { sql: "p.id", filter: "in" },
        code: { sql: "p.code", filter: "contains" },
        enabled: { sql: "p.enabled", filter: "in" },
        createdAt: { sql: 'p."createdAt"', filter: "dateRange" }
      },
      "p.code,p.id",
      "p.id"
    );
    const filter =
      (catalog ? ' WHERE p.enabled AND p."currentVersionId" IS NOT NULL' : "") +
      (catalog ? listing.and : listing.where);
    const items = await this.db.query<PlanView>(
      (catalog ? PLAN_SELECT + PLAN_FROM : ADMIN_SELECT) +
        filter +
        " ORDER BY " +
        listing.order +
        " LIMIT :limit OFFSET :offset",
      { replacements: { ...page, ...listing.parameters, catalog }, type: QueryTypes.SELECT }
    );
    const [count] = await this.db.query<{ total: number }>("SELECT COUNT(*)::int total FROM plans p" + filter, {
      replacements: listing.parameters,
      type: QueryTypes.SELECT
    });
    return { items, total: count.total };
  }
  /**
   * Creates or updates a commercial draft.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async version(id: string, input: PlanVersionInput & { draftId?: string }, actor: AccessActor) {
    return this.db.transaction(async transaction => {
      const [plan] = await this.db.query<PlanView>("SELECT * FROM plans WHERE id=:id FOR UPDATE", {
        replacements: { id },
        transaction,
        type: QueryTypes.SELECT
      });
      if (!plan) throw new NotFoundException("No se encontró el plan");
      if (input.benefitIds?.length) {
        const [count] = await this.db.query<{ total: number }>(
          "SELECT COUNT(*)::int AS total FROM benefit_definitions WHERE id IN (:ids)",
          { replacements: { ids: input.benefitIds }, transaction, type: QueryTypes.SELECT }
        );
        if (count.total !== input.benefitIds.length)
          throw new BadRequestException("Uno o más beneficios seleccionados no existen");
      }
      const [before] = input.draftId
        ? await this.db.query<PlanVersion>('SELECT * FROM plan_versions WHERE id=:draftId AND "planId"=:id', {
            replacements: { id, draftId: input.draftId },
            transaction,
            type: QueryTypes.SELECT
          })
        : [];
      if (input.draftId && !before) throw new NotFoundException("La versión no pertenece a este plan");
      if (before?.publishedAt) throw new ConflictException("Solo se pueden editar versiones sin publicar");

      const fields = {
        id,
        versionId: before?.id ?? randomUUID(),
        name: input.name.trim(),
        description: input.description.trim(),
        benefits: JSON.stringify(input.benefitDescriptions ?? before?.benefitDescriptions ?? []),
        benefitIds: JSON.stringify(input.benefitIds ?? before?.benefitIds ?? null),
        familyLimit: input.maxBeneficiaries ?? before?.maxBeneficiaries ?? null,
        monthly: input.monthlyPriceCents,
        annual: input.annualPriceCents,
        tax: input.taxDisclosure.trim()
      };
      const benefitIdsSql =
        "CASE WHEN CAST(:benefitIds AS JSONB)='null'::jsonb THEN NULL ELSE ARRAY(SELECT jsonb_array_elements_text(CAST(:benefitIds AS JSONB))::uuid) END";
      const [row] = await this.db.query<PlanVersion>(
        before
          ? `UPDATE plan_versions SET name=:name,description=:description,"benefitDescriptions"=CAST(:benefits AS JSONB),
              "benefitIds"=${benefitIdsSql},"monthlyPriceCents"=:monthly,"annualPriceCents"=:annual,
              "taxDisclosure"=:tax,"maxBeneficiaries"=:familyLimit
            WHERE id=:versionId AND "planId"=:id AND "publishedAt" IS NULL RETURNING *`
          : `INSERT INTO plan_versions (id,"planId",number,name,description,"benefitDescriptions","benefitIds",
              "monthlyPriceCents","annualPriceCents",currency,"taxDisclosure","maxBeneficiaries","createdAt")
            SELECT CAST(:versionId AS uuid),CAST(:id AS uuid),COALESCE(MAX(number),0)+1,:name,:description,CAST(:benefits AS JSONB),
              ${benefitIdsSql},:monthly,:annual,'GTQ',:tax,:familyLimit,NOW()
            FROM plan_versions WHERE "planId"=:id RETURNING *`,
        { replacements: fields, transaction, type: QueryTypes.SELECT }
      );
      if (!row) throw new ConflictException("Solo se pueden editar versiones sin publicar");
      const auditedFields = [
        "id",
        "number",
        "name",
        "description",
        "benefitDescriptions",
        "benefitIds",
        "maxBeneficiaries",
        "monthlyPriceCents",
        "annualPriceCents",
        "currency",
        "taxDisclosure"
      ] as const;
      await recordChange(this.db, transaction, {
        action: before ? "plan.version-updated" : "plan.version-created",
        resourceType: "plan",
        resourceId: id,
        actorId: actor.id,
        before: before && auditSnapshot(before, auditedFields),
        after: auditSnapshot(row, auditedFields)
      });
      return row;
    });
  }
  /**
   * Lists commercial drafts and published history.
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
      if (typeof version.maxBeneficiaries === "number") {
        await this.db.query(
          `INSERT INTO plan_family_settings ("planId","maxBeneficiaries","updatedAt") VALUES (:id,:limit,NOW())
          ON CONFLICT ("planId") DO UPDATE SET "maxBeneficiaries"=EXCLUDED."maxBeneficiaries","updatedAt"=NOW()`,
          { replacements: { id, limit: version.maxBeneficiaries }, transaction }
        );
      }
      if (version.benefitIds) {
        const options = { replacements: { id, benefitIds: JSON.stringify(version.benefitIds) }, transaction };
        await this.db.query(
          `DELETE FROM plan_benefits WHERE "planId"=:id AND "benefitId" NOT IN (
            SELECT jsonb_array_elements_text(CAST(:benefitIds AS JSONB))::uuid
          )`,
          options
        );
        await this.db.query(
          `INSERT INTO plan_benefits ("planId","benefitId")
            SELECT :id, jsonb_array_elements_text(CAST(:benefitIds AS JSONB))::uuid ON CONFLICT DO NOTHING`,
          options
        );
      }
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
        after: {
          currentVersionId: versionId,
          number: version.number,
          benefitIds: version.benefitIds ?? null,
          maxBeneficiaries: version.maxBeneficiaries ?? null
        }
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
  /**
   * Changes the plan entitlement without modifying contracts, rules or usage.
   * @param id Plan identifier.
   * @param benefitId Catalog benefit identifier.
   * @param assigned Desired assignment state.
   * @param actor Authenticated operator.
   */
  async assignBenefit(id: string, benefitId: string, assigned: boolean, actor: AccessActor) {
    await this.db.transaction(async transaction => {
      const options = { replacements: { id, benefitId }, transaction, type: QueryTypes.SELECT } as const;
      const [plan] = await this.db.query("SELECT id FROM plans WHERE id=:id FOR UPDATE", options);
      if (!plan) throw new NotFoundException("No se encontró el plan");
      const [benefit] = await this.db.query("SELECT id FROM benefit_definitions WHERE id=:benefitId", options);
      if (!benefit) throw new NotFoundException("No se encontró el beneficio");
      const [changed] = await this.db.query(
        assigned
          ? 'INSERT INTO plan_benefits ("planId","benefitId") VALUES (:id,:benefitId) ON CONFLICT DO NOTHING RETURNING "benefitId"'
          : 'DELETE FROM plan_benefits WHERE "planId"=:id AND "benefitId"=:benefitId RETURNING "benefitId"',
        options
      );
      if (!changed) return;
      await recordChange(this.db, transaction, {
        action: assigned ? "plan.benefit-assigned" : "plan.benefit-removed",
        resourceType: "plan",
        resourceId: id,
        actorId: actor.id,
        before: { benefitId, assigned: !assigned },
        after: { benefitId, assigned }
      });
    });
  }
}

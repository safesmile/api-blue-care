import { sqlListQuery } from "../../../shared/infrastructure/sql-list-query";
import { ConflictException, Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, UniqueConstraintError, type Transaction } from "sequelize";
import { randomUUID } from "node:crypto";
import {
  BenefitRepository,
  type BenefitInput,
  type BenefitQuery,
  type BenefitVersion,
  type BenefitVersionInput,
  type BenefitView
} from "../domain/benefit.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { recordChange } from "../../audit/infrastructure/record-change";
import { auditSnapshot } from "../../audit/domain/audit-snapshot";
const BENEFIT_CATALOG = ` FROM benefit_definitions b LEFT JOIN benefit_versions v ON v.id=b."currentVersionId"
  LEFT JOIN LATERAL (
    SELECT * FROM benefit_versions candidate
    WHERE candidate."benefitId"=b.id AND candidate."publishedAt" IS NULL
      AND candidate.number>COALESCE(v.number,0)
    ORDER BY candidate.number DESC LIMIT 1
  ) draft ON TRUE`;
const SELECT_BENEFIT = 'SELECT b.*,TO_JSONB(v) AS "currentVersion",TO_JSONB(draft) AS "latestDraft"' + BENEFIT_CATALOG;
/** Keeps quota identity stable while publishing immutable rule revisions. */
@Injectable()
export class SqlBenefitRepository extends BenefitRepository {
  /**
   * Recibe las dependencias de la operación.
   * @param db Dependencia tipada de db.
   */
  constructor(private readonly db: Sequelize) {
    super();
  }
  /**
   * Creates a stable benefit definition.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async create(input: BenefitInput, actor: AccessActor) {
    const id = randomUUID();
    try {
      await this.db.transaction(async transaction => {
        const { initialVersion, ...definition } = input;
        const planId = definition.planId ?? null;
        const replacements = { ...definition, id, planId };
        if (planId) {
          const [plan] = await this.db.query("SELECT id FROM plans WHERE id=:planId FOR SHARE", {
            replacements,
            transaction,
            type: QueryTypes.SELECT
          });
          if (!plan) throw new NotFoundException("No se encontró el plan");
        }
        await this.db.query(
          'INSERT INTO benefit_definitions (id,"planId",code,kind,period,audience,"createdAt") VALUES (:id,:planId,:code,:kind,:period,:audience,NOW())',
          { replacements, transaction }
        );
        if (planId)
          await this.db.query('INSERT INTO plan_benefits ("planId","benefitId") VALUES (:planId,:id)', {
            replacements,
            transaction
          });
        await recordChange(this.db, transaction, {
          action: "benefit.created",
          resourceType: "benefit",
          resourceId: id,
          actorId: actor.id,
          after: { ...definition, id }
        });
        if (initialVersion) await this.saveVersion(id, definition.kind, 1, initialVersion, actor, transaction);
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw new ConflictException("El código del beneficio ya existe");
      throw error;
    }
    return (await this.read(id))!;
  }
  /**
   * Reads a benefit definition and its published revision.
   * @param id Resource identifier.
   * @returns The persisted result or completion of the authorized operation.
   */
  async read(id: string) {
    const [row] = await this.db.query<BenefitView>(SELECT_BENEFIT + " WHERE b.id=:id", {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    return row ?? null;
  }
  /**
   * Lists the authorized benefit catalog.
   * @param query Bounded explicit catalog filters.
   * @returns The persisted result or completion of the authorized operation.
   */
  async list(query: BenefitQuery) {
    const listing = sqlListQuery(
      query,
      {
        code: { sql: "b.code", filter: "contains" },
        search: { sql: "CONCAT_WS(CHR(32),b.code,COALESCE(v.name,draft.name))", filter: "contains" },
        kind: { sql: "b.kind", filter: "in" },
        createdAt: { sql: 'b."createdAt"', filter: "dateRange" }
      },
      "b.code,b.id",
      "b.id"
    );
    const replacements = {
      ...query,
      ...listing.parameters,
      planId: query.planId ?? null,
      availableForPlanId: query.availableForPlanId ?? null
    };
    const filter =
      ` WHERE (:planId IS NULL OR EXISTS (
      SELECT 1 FROM plan_benefits pb WHERE pb."benefitId"=b.id AND pb."planId"=:planId))
      AND (:availableForPlanId IS NULL OR NOT EXISTS (
      SELECT 1 FROM plan_benefits pb WHERE pb."benefitId"=b.id AND pb."planId"=:availableForPlanId))` + listing.and;
    const items = await this.db.query<BenefitView>(
      SELECT_BENEFIT + filter + " ORDER BY " + listing.order + " LIMIT :limit OFFSET :offset",
      { replacements, type: QueryTypes.SELECT }
    );
    const [count] = await this.db.query<{ total: number }>("SELECT COUNT(*)::int total" + BENEFIT_CATALOG + filter, {
      replacements,
      type: QueryTypes.SELECT
    });
    return { items, total: count.total };
  }
  /**
   * Creates or updates a rule draft.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async version(id: string, input: BenefitVersionInput & { draftId?: string }, actor: AccessActor) {
    return this.db.transaction(async transaction => {
      const [benefit] = await this.db.query<BenefitView>("SELECT * FROM benefit_definitions WHERE id=:id FOR UPDATE", {
        replacements: { id },
        transaction,
        type: QueryTypes.SELECT
      });
      if (!benefit) throw new NotFoundException("No se encontró el beneficio");
      if (input.draftId) {
        const [draft] = await this.db.query<BenefitVersion>(
          'SELECT * FROM benefit_versions WHERE id=:draftId AND "benefitId"=:id',
          { replacements: { id, draftId: input.draftId }, transaction, type: QueryTypes.SELECT }
        );
        if (!draft) throw new NotFoundException("La versión no pertenece a este beneficio");
        if (draft.publishedAt) throw new ConflictException("Solo se pueden editar versiones sin publicar");
        return this.saveVersion(id, benefit.kind, draft.number, input, actor, transaction, draft);
      }
      const [next] = await this.db.query<{ number: number }>(
        'SELECT COALESCE(MAX(number),0)+1 AS number FROM benefit_versions WHERE "benefitId"=:id',
        { replacements: { id }, transaction, type: QueryTypes.SELECT }
      );
      return this.saveVersion(id, benefit.kind, next.number, input, actor, transaction);
    });
  }
  /**
   * Persists a draft and its audit event in the caller's transaction.
   * @param id Benefit identifier.
   * @param kind Stable benefit type.
   * @param number Revision number.
   * @param input Draft values.
   * @param actor Authenticated operator.
   * @param transaction Open transaction.
   * @param before Existing draft when updating.
   * @returns Saved revision.
   */
  private async saveVersion(
    id: string,
    kind: BenefitView["kind"],
    number: number,
    input: BenefitVersionInput,
    actor: AccessActor,
    transaction: Transaction,
    before?: BenefitVersion
  ) {
    if ((kind === "discount") !== (input.discountBasisPoints !== undefined && input.discountBasisPoints !== null))
      throw new BadRequestException(
        "Los descuentos requieren puntos básicos; los servicios y artículos deben omitirlos"
      );
    const [row] = await this.db.query<BenefitVersion>(
      before
        ? `UPDATE benefit_versions SET name=:name,description=:description,"limitUnits"=:limitUnits,
            "discountBasisPoints"=:discountBasisPoints,enabled=:enabled
          WHERE id=:versionId AND "benefitId"=:id AND "publishedAt" IS NULL RETURNING *`
        : `INSERT INTO benefit_versions (id,"benefitId",number,name,description,"limitUnits","discountBasisPoints",enabled,"createdAt")
       VALUES (:versionId,:id,:number,:name,:description,:limitUnits,:discountBasisPoints,:enabled,NOW()) RETURNING *`,
      {
        replacements: {
          ...input,
          id,
          versionId: before?.id ?? randomUUID(),
          number,
          discountBasisPoints: input.discountBasisPoints ?? null
        },
        transaction,
        type: QueryTypes.SELECT
      }
    );
    if (!row) throw new ConflictException("Solo se pueden editar versiones sin publicar");
    const auditedFields = [
      "id",
      "number",
      "name",
      "description",
      "limitUnits",
      "discountBasisPoints",
      "enabled"
    ] as const;
    await recordChange(this.db, transaction, {
      action: before ? "benefit.version-updated" : "benefit.version-created",
      resourceType: "benefit",
      resourceId: id,
      actorId: actor.id,
      before: before && auditSnapshot(before, auditedFields),
      after: auditSnapshot(row, auditedFields)
    });
    return row;
  }
  /**
   * Lists rule drafts and published history.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @returns The persisted result or completion of the authorized operation.
   */
  async versions(id: string, page: Pagination) {
    if (!(await this.read(id))) throw new NotFoundException("No se encontró el beneficio");
    const items = await this.db.query<BenefitVersion>(
      'SELECT * FROM benefit_versions WHERE "benefitId"=:id ORDER BY number DESC LIMIT :limit OFFSET :offset',
      { replacements: { id, ...page }, type: QueryTypes.SELECT }
    );
    const [count] = await this.db.query<{ total: number }>(
      'SELECT COUNT(*)::int total FROM benefit_versions WHERE "benefitId"=:id',
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    return { items, total: count.total };
  }
  /**
   * Publishes the revision for all current and future members.
   * @param id Resource identifier.
   * @param versionId Immutable rule revision identifier.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async publish(id: string, versionId: string, actor: AccessActor) {
    await this.db.transaction(async transaction => {
      const [before] = await this.db.query<BenefitView>("SELECT * FROM benefit_definitions WHERE id=:id FOR UPDATE", {
        replacements: { id },
        transaction,
        type: QueryTypes.SELECT
      });
      if (!before) throw new NotFoundException("No se encontró el beneficio");
      if (before.currentVersionId === versionId) return;
      const [version] = await this.db.query<BenefitVersion>(
        'SELECT * FROM benefit_versions WHERE id=:versionId AND "benefitId"=:id',
        { replacements: { id, versionId }, transaction, type: QueryTypes.SELECT }
      );
      if (!version) throw new NotFoundException("La versión no pertenece a este beneficio");
      if (version.publishedAt)
        throw new ConflictException("Cree una nueva versión; no se pueden volver a publicar reglas históricas");
      await this.db.query('UPDATE benefit_versions SET "publishedAt"=NOW() WHERE id=:versionId', {
        replacements: { versionId },
        transaction
      });
      await this.db.query('UPDATE benefit_definitions SET "currentVersionId"=:versionId WHERE id=:id', {
        replacements: { id, versionId },
        transaction
      });
      await recordChange(this.db, transaction, {
        action: "benefit.published",
        resourceType: "benefit",
        resourceId: id,
        actorId: actor.id,
        before: { currentVersionId: before.currentVersionId },
        after: { currentVersionId: versionId, number: version.number }
      });
    });
    return (await this.read(id))!;
  }
  /**
   * Reads the configured additional-family limit.
   * @param planId Plan identifier.
   * @returns The persisted result or completion of the authorized operation.
   */
  async familySettings(planId: string) {
    const [plan] = await this.db.query<{ id: string }>("SELECT id FROM plans WHERE id=:planId", {
      replacements: { planId },
      type: QueryTypes.SELECT
    });
    if (!plan) throw new NotFoundException("No se encontró el plan");
    const [row] = await this.db.query<{ planId: string; maxBeneficiaries: number }>(
      'SELECT "planId","maxBeneficiaries" FROM plan_family_settings WHERE "planId"=:planId',
      { replacements: { planId }, type: QueryTypes.SELECT }
    );
    return row ?? { planId, maxBeneficiaries: 4 };
  }
  /**
   * Changes the family limit without deleting existing relatives.
   * @param planId Plan identifier.
   * @param maxBeneficiaries Maximum additional beneficiaries.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async updateFamilySettings(planId: string, maxBeneficiaries: number, actor: AccessActor) {
    await this.db.transaction(async transaction => {
      const [plan] = await this.db.query<{ id: string }>("SELECT id FROM plans WHERE id=:planId FOR UPDATE", {
        replacements: { planId },
        transaction,
        type: QueryTypes.SELECT
      });
      if (!plan) throw new NotFoundException("No se encontró el plan");
      const [settings] = await this.db.query<{ maxBeneficiaries: number }>(
        'SELECT "maxBeneficiaries" FROM plan_family_settings WHERE "planId"=:planId',
        { replacements: { planId }, transaction, type: QueryTypes.SELECT }
      );
      const before = settings?.maxBeneficiaries ?? 4;
      if (before === maxBeneficiaries) return;
      await this.db.query(
        `INSERT INTO plan_family_settings ("planId","maxBeneficiaries","updatedAt") VALUES (:planId,:maxBeneficiaries,NOW())
        ON CONFLICT ("planId") DO UPDATE SET "maxBeneficiaries"=EXCLUDED."maxBeneficiaries","updatedAt"=NOW()`,
        { replacements: { planId, maxBeneficiaries }, transaction }
      );
      await recordChange(this.db, transaction, {
        action: "benefit.family-limit-updated",
        resourceType: "plan",
        resourceId: planId,
        actorId: actor.id,
        before: { maxBeneficiaries: before },
        after: { maxBeneficiaries }
      });
    });
    return { planId, maxBeneficiaries };
  }
}

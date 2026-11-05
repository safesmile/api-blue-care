import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  BenefitRepository,
  type BenefitInput,
  type BenefitQuery,
  type BenefitVersionInput
} from "../domain/benefit.repository";
import { AccessPolicy, type AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import type { Permission } from "../../../shared/domain/permission";
/** Coordinates explicit configuration permissions without granting clinical consumption authority. */
@Injectable()
export class BenefitsUseCase {
  /**
   * Initializes the benefit service dependencies.
   * @param benefits Benefit configuration repository or application service.
   */
  constructor(private readonly benefits: BenefitRepository) {}
  /**
   * Creates a stable benefit definition.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  create(input: BenefitInput, actor: AccessActor) {
    this.require(actor, "benefits:create");
    return this.benefits.create(input, actor);
  }
  /**
   * Reads a benefit definition and its published revision.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async read(id: string, actor: AccessActor) {
    this.require(actor, "benefits:read");
    const benefit = await this.benefits.read(id);
    if (!benefit) throw new NotFoundException("Benefit not found");
    return benefit;
  }
  /**
   * Lists the authorized benefit catalog.
   * @param query Bounded explicit catalog filters.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  list(query: BenefitQuery, actor: AccessActor) {
    this.require(actor, "benefits:list");
    return this.benefits.list(query);
  }
  /**
   * Appends an immutable rule revision.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  version(id: string, input: BenefitVersionInput, actor: AccessActor) {
    this.require(actor, "benefits:version");
    if (!Number.isSafeInteger(input.limitUnits) || input.limitUnits < 1 || input.limitUnits > 100000)
      throw new BadRequestException("Invalid quota limit");
    if (
      input.discountBasisPoints !== undefined &&
      input.discountBasisPoints !== null &&
      (!Number.isSafeInteger(input.discountBasisPoints) ||
        input.discountBasisPoints < 1 ||
        input.discountBasisPoints > 10000)
    )
      throw new BadRequestException("Invalid discount basis points");
    return this.benefits.version(id, input, actor);
  }
  /**
   * Lists immutable rule revisions.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  versions(id: string, page: Pagination, actor: AccessActor) {
    this.require(actor, "benefits:read");
    return this.benefits.versions(id, page);
  }
  /**
   * Publishes the revision for all current and future members.
   * @param id Resource identifier.
   * @param versionId Immutable rule revision identifier.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  publish(id: string, versionId: string, actor: AccessActor) {
    this.require(actor, "benefits:publish");
    return this.benefits.publish(id, versionId, actor);
  }
  /**
   * Reads the configured additional-family limit.
   * @param planId Plan identifier.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  familySettings(planId: string, actor: AccessActor) {
    this.require(actor, "benefits:read");
    return this.benefits.familySettings(planId);
  }
  /**
   * Changes the family limit without deleting existing relatives.
   * @param planId Plan identifier.
   * @param max Maximum additional beneficiaries.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  updateFamilySettings(planId: string, max: number, actor: AccessActor) {
    this.require(actor, "benefits:family-settings");
    if (!Number.isSafeInteger(max) || max < 0 || max > 100) throw new BadRequestException("Invalid family maximum");
    return this.benefits.updateFamilySettings(planId, max, actor);
  }
  /**
   * Validates and coordinates the authorized benefit operation.
   * @param actor Authenticated identity and current effective permissions.
   * @param permission Explicit operation permission.
   */
  private require(actor: AccessActor, permission: Permission) {
    if (!AccessPolicy.allows(actor, permission))
      throw new ForbiddenException("Benefit configuration permission required");
  }
}

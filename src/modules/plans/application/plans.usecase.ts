import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PlanRepository, type PlanVersionInput } from "../domain/plan.repository";
import { AccessPolicy, type AccessActor } from "../../authorization/domain/access-policy";
import type { Permission } from "../../../shared/domain/permission";
import type { Pagination } from "../../../shared/domain/crud.repository";
/** Separates publication and immutable pricing history from later benefit consumption. */
@Injectable()
export class PlansUseCase {
  /**
   * Receives the persistence and policy boundaries.
   * @param plans Versioned plan repository port.
   */
  constructor(private readonly plans: PlanRepository) {}
  /**
   * Creates an explicitly authorized pending record.
   * @param code Stable commercial code or required permission.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  create(code: string, actor: AccessActor) {
    this.require(actor, "plans:create");
    return this.plans.create(code, actor);
  }
  /**
   * Reads one authorized resource without changing its state.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async read(id: string, actor: AccessActor) {
    this.require(actor, "plans:read");
    const plan = await this.plans.read(id);
    if (!plan) throw new NotFoundException("Plan not found");
    return plan;
  }
  /**
   * Returns a bounded page within the caller scope.
   * @param page Bounded pagination values.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  list(page: Pagination, actor: AccessActor) {
    this.require(actor, "plans:list");
    return this.plans.list(page, false);
  }
  /**
   * Lists published plans available for new contracts.
   * @param page Bounded pagination values.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  catalog(page: Pagination, actor: AccessActor) {
    this.require(actor, "plans:catalog");
    return this.plans.list(page, true);
  }
  /**
   * Appends an immutable commercial revision.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  version(id: string, input: PlanVersionInput, actor: AccessActor) {
    this.require(actor, "plans:version");
    if (
      !Number.isSafeInteger(input.monthlyPriceCents) ||
      input.monthlyPriceCents < 500 ||
      input.monthlyPriceCents > 100000000
    )
      throw new BadRequestException("Final monthly price must be an integer from 500 to 100000000 GTQ cents");
    return this.plans.version(id, input, actor);
  }
  /**
   * Lists immutable commercial history.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  versions(id: string, page: Pagination, actor: AccessActor) {
    this.require(actor, "plans:read");
    return this.plans.versions(id, page);
  }
  /**
   * Publishes a new revision without rewriting existing contracts.
   * @param id Resource identifier.
   * @param versionId Immutable plan revision identifier.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  publish(id: string, versionId: string, actor: AccessActor) {
    this.require(actor, "plans:publish");
    return this.plans.publish(id, versionId, actor);
  }
  /**
   * Changes whether a plan accepts new contracts.
   * @param id Resource identifier.
   * @param enabled Whether the plan accepts new contracts.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  update(id: string, enabled: boolean, actor: AccessActor) {
    this.require(actor, "plans:update");
    return this.plans.update(id, enabled, actor);
  }
  /**
   * Requires explicit operation authority.
   * @param actor Authenticated identity and current effective permissions.
   * @param code Stable commercial code or required permission.
   */
  private require(actor: AccessActor, code: Permission) {
    if (!AccessPolicy.allows(actor, code)) throw new ForbiddenException("Plan permission required");
  }
}

import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ClinicRepository, type ClinicInput, type ClinicQuery } from "../domain/clinic.repository";
import { AccessPolicy, type AccessActor } from "../../authorization/domain/access-policy";
import type { Permission } from "../../../shared/domain/permission";
import type { Pagination } from "../../../shared/domain/crud.repository";
/** Coordinates clinic catalog operations without deciding access from role names. */
@Injectable()
export class ClinicsUseCase {
  /**
   *
   * @param clinics Clinic repository port.
   */
  constructor(private readonly clinics: ClinicRepository) {}
  /**
   * Creates an independent administrative record.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  create(input: ClinicInput, actor: AccessActor) {
    this.require(actor, "clinics:create");
    this.require(actor, "clinics:all");
    return this.clinics.create(input, actor);
  }
  /**
   * Reads a resource within the authorized scope.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async read(id: string, actor: AccessActor) {
    this.require(actor, "clinics:read");
    const clinic = await this.clinics.read(id, actor);
    if (!clinic) throw new NotFoundException("Clinic not found");
    return clinic;
  }
  /**
   * Returns a bounded page within the authorized scope.
   * @param query Bounded search and status filters.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  list(query: ClinicQuery, actor: AccessActor) {
    this.require(actor, "clinics:list");
    return this.clinics.list(query, actor);
  }
  /**
   * Updates only allowed administrative fields.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  update(id: string, input: Partial<ClinicInput> & { enabled?: boolean }, actor: AccessActor) {
    this.require(actor, "clinics:update");
    return this.clinics.update(id, input, actor);
  }
  /**
   * Lists bounded staff assignments for the clinic.
   * @param id Resource identifier.
   * @param page Bounded pagination.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  staff(id: string, page: Pagination, actor: AccessActor) {
    this.require(actor, "clinics:staff-list");
    return this.clinics.staff(id, page, actor);
  }
  /**
   * Grants a clinic assignment using explicit global authority.
   * @param id Resource identifier.
   * @param userId Account identifier selected by the server or verified against registered contact.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  assign(id: string, userId: string, actor: AccessActor) {
    this.require(actor, "clinics:staff-manage");
    this.require(actor, "clinics:all");
    return this.clinics.assign(id, userId, actor);
  }
  /**
   * Removes a clinic assignment using explicit global authority.
   * @param id Resource identifier.
   * @param userId Account identifier selected by the server or verified against registered contact.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  unassign(id: string, userId: string, actor: AccessActor) {
    this.require(actor, "clinics:staff-manage");
    this.require(actor, "clinics:all");
    return this.clinics.unassign(id, userId, actor);
  }
  /**
   * Requires explicit operation authority or clinic assignment.
   * @param actor Authenticated identity and current permissions.
   * @param permission Operation argument.
   */
  private require(actor: AccessActor, permission: Permission) {
    if (!AccessPolicy.allows(actor, permission)) throw new ForbiddenException("Clinic permission required");
  }
}

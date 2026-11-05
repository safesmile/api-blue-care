import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PatientRepository, type PatientInput, type PatientQuery } from "../domain/patient.repository";
import { AccessPolicy, type AccessActor } from "../../authorization/domain/access-policy";
import type { Permission } from "../../../shared/domain/permission";
import { personName } from "../../../shared/domain/person-name";
/** Keeps patient records independent from account credentials and commercial membership. */
@Injectable()
export class PatientsUseCase {
  /**
   *
   * @param patients Patient repository port.
   */
  constructor(private readonly patients: PatientRepository) {}
  /**
   * Creates an independent administrative record.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  create(input: PatientInput & { clinicId: string }, actor: AccessActor) {
    this.require(actor, "patients:create");
    this.validate(input);
    return this.patients.create(input, actor);
  }
  /**
   * Reads a resource within the authorized scope.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async read(id: string, actor: AccessActor) {
    this.require(actor, "patients:read");
    const patient = await this.patients.read(id, actor);
    if (!patient) throw new NotFoundException("Patient not found");
    return patient;
  }
  /**
   * Returns a bounded page within the authorized scope.
   * @param query Bounded search and status filters.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  list(query: PatientQuery, actor: AccessActor) {
    this.require(actor, "patients:list");
    return this.patients.list(query, actor);
  }
  /**
   * Updates only allowed administrative fields.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  update(id: string, input: Partial<PatientInput> & { enabled?: boolean }, actor: AccessActor) {
    this.require(actor, "patients:update");
    this.validate(input);
    return this.patients.update(id, input, actor);
  }
  /**
   * Reads the patient bound to the authenticated account.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async own(actor: AccessActor) {
    this.require(actor, "patients:self");
    const patient = await this.patients.own(actor.id);
    if (!patient) throw new NotFoundException("No patient linked to this account");
    return patient;
  }
  /**
   * Updates permitted profile fields of the authenticated patient.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async updateOwn(input: Pick<PatientInput, "phone" | "birthDate" | "address">, actor: AccessActor) {
    await this.own(actor);
    this.validate(input);
    return this.patients.updateOwn(
      actor.id,
      { phone: input.phone, birthDate: input.birthDate, address: input.address },
      actor
    );
  }
  /**
   * Binds a patient only to a verified matching account.
   * @param id Resource identifier.
   * @param userId Account identifier selected by the server or verified against registered contact.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  link(id: string, userId: string, actor: AccessActor) {
    this.require(actor, "patients:link");
    return this.patients.link(id, userId, actor);
  }
  /**
   * Adds an authorized clinic association without duplicating the patient.
   * @param id Resource identifier.
   * @param clinicId Clinic identifier.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  associate(id: string, clinicId: string, actor: AccessActor) {
    this.require(actor, "patients:update");
    this.require(actor, "clinics:all");
    return this.patients.associate(id, clinicId, actor);
  }
  /**
   * Lists visible clinic associations for this patient.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  clinics(id: string, actor: AccessActor) {
    this.require(actor, "patients:read");
    return this.patients.clinics(id, actor);
  }
  /**
   * Removes a clinic association using explicit global authority.
   * @param id Patient identifier.
   * @param clinicId Clinic identifier.
   * @param actor Authenticated identity and current permissions.
   * @returns Completion of the authorized operation.
   */
  dissociate(id: string, clinicId: string, actor: AccessActor) {
    this.require(actor, "patients:update");
    this.require(actor, "clinics:all");
    return this.patients.dissociate(id, clinicId, actor);
  }
  /**
   * Requires explicit operation authority or clinic assignment.
   * @param actor Authenticated identity and current permissions.
   * @param permission Operation argument.
   */
  private require(actor: AccessActor, permission: Permission) {
    if (!AccessPolicy.allows(actor, permission)) throw new ForbiddenException("Patient permission required");
  }
  /**
   * Validates names and calendar birth dates.
   * @param input Validated operation fields.
   */
  private validate(input: Partial<PatientInput>) {
    if (input.firstName !== undefined && input.lastName !== undefined && !personName(input.firstName, input.lastName))
      throw new BadRequestException("Invalid patient names");
    if (
      input.birthDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate) ||
        input.birthDate.startsWith("0000-") ||
        !Number.isFinite(Date.parse(input.birthDate)) ||
        new Date(input.birthDate).toISOString().slice(0, 10) !== input.birthDate ||
        input.birthDate > new Date().toISOString().slice(0, 10))
    )
      throw new BadRequestException("Birth date must be a valid past or current calendar date");
  }
}

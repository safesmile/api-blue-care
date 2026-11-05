import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MembershipRepository, type MembershipInput, type MembershipQuery } from "../domain/membership.repository";
import { MembershipBilling, MembershipGateway } from "../domain/membership-billing";
import { PatientRepository } from "../../patients/domain/patient.repository";
import { AccessPolicy, type AccessActor } from "../../authorization/domain/access-policy";
import type { Permission } from "../../../shared/domain/permission";
import type { Pagination } from "../../../shared/domain/crud.repository";
/** Coordinates contract ownership, operation authority and durable billing boundaries. */
@Injectable()
export class MembershipsUseCase {
  /**
   * Receives the persistence and policy boundaries.
   * @param memberships Patient-global membership repository port.
   * @param patients Patient identity repository port.
   * @param billing Durable billing inbox and outbox.
   * @param gateway External provider verification and billing port.
   */
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly patients: PatientRepository,
    private readonly billing: MembershipBilling,
    private readonly gateway: MembershipGateway
  ) {}
  /**
   * Creates an explicitly authorized pending record.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  create(input: MembershipInput, actor: AccessActor) {
    this.require(actor, "memberships:create");
    this.validate(input.cadence);
    return this.memberships.create(input, actor, false);
  }
  /**
   * Creates a contract for the account-linked patient only.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async createOwn(input: Omit<MembershipInput, "patientId">, actor: AccessActor) {
    this.require(actor, "memberships:self");
    this.validate(input.cadence);
    const patient = await this.patients.own(actor.id);
    if (!patient) throw new NotFoundException("No patient linked to this account");
    return this.memberships.create({ ...input, patientId: patient.id }, actor, true);
  }
  /**
   * Reads one authorized resource without changing its state.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether access is limited to the authenticated patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  async read(id: string, actor: AccessActor, own = false) {
    this.require(actor, own ? "memberships:self" : "memberships:read");
    const membership = await this.memberships.read(id, actor, own);
    if (!membership) throw new NotFoundException("Membership not found");
    return membership;
  }
  /**
   * Returns a bounded page within the caller scope.
   * @param query Bounded explicit search filters.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether access is limited to the authenticated patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  list(query: MembershipQuery, actor: AccessActor, own = false) {
    this.require(actor, own ? "memberships:self" : "memberships:list");
    return this.memberships.list(query, actor, own);
  }
  /**
   * Stops future renewals while preserving confirmed paid coverage.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether access is limited to the authenticated patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  cancel(id: string, actor: AccessActor, own = false) {
    this.require(actor, own ? "memberships:self" : "memberships:cancel");
    return this.memberships.cancel(id, actor, own);
  }
  /**
   * Suspends benefit eligibility immediately and queues billing pause.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  suspend(id: string, actor: AccessActor) {
    this.require(actor, "memberships:suspend");
    return this.memberships.suspend(id, actor);
  }
  /**
   * Lists immutable payments and their allocated periods.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether access is limited to the authenticated patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  periods(id: string, page: Pagination, actor: AccessActor, own = false) {
    this.require(actor, own ? "memberships:self" : "memberships:read");
    return this.memberships.periods(id, page, actor, own);
  }
  /**
   * Obtains one durable hosted quote without repeating ambiguous provider creation.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  async checkout(id: string, actor: AccessActor) {
    await this.read(id, actor, true);
    return this.billing.checkout(id);
  }
  /**
   * Persists a verified minimal provider envelope before acknowledgement.
   * @param body Original provider request bytes.
   * @param headers Provider signature headers.
   */
  async receive(body: Buffer, headers: Record<string, unknown>) {
    await this.billing.receive(this.gateway.verify(body, headers));
  }
  /**
   * Processes one bounded durable payment and billing batch.
   * @returns The persisted result or completion of the authorized operation.
   */
  drain() {
    return this.billing.drain();
  }
  /**
   * Requires explicit operation authority.
   * @param actor Authenticated identity and current effective permissions.
   * @param code Stable commercial code or required permission.
   */
  private require(actor: AccessActor, code: Permission) {
    if (!AccessPolicy.allows(actor, code)) throw new ForbiddenException("Membership permission required");
  }
  /**
   * Rejects unsupported billing intervals.
   * @param cadence Immutable monthly or annual billing interval.
   */
  private validate(cadence: string) {
    if (!["monthly", "annual"].includes(cadence)) throw new BadRequestException("Invalid billing cadence");
  }
}

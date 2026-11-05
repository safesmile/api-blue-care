import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import {
  BenefitOperationsRepository,
  type BeneficiaryInput,
  type ConsumptionInput,
  type TicketConsumptionInput,
  type TicketInput
} from "../domain/benefit-operations.repository";
import { AccessPolicy, type AccessActor } from "../../authorization/domain/access-policy";
import type { Pagination } from "../../../shared/domain/crud.repository";
import type { Permission } from "../../../shared/domain/permission";
import { personName } from "../../../shared/domain/person-name";
import { validBeneficiaryDate } from "../domain/beneficiary-date";
/** Separates owner presentation from staff consumption and explicit correction authority. */
@Injectable()
export class BenefitOperationsUseCase {
  /**
   * Initializes the benefit service dependencies.
   * @param operations Benefit operations repository or application service.
   */
  constructor(private readonly operations: BenefitOperationsRepository) {}
  /**
   * Lists the patient family independently of contract renewal.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether the resource is restricted to the account-linked patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  family(id: string, page: Pagination, actor: AccessActor, own = false) {
    this.require(actor, own ? "benefits:self" : "benefits:balances");
    return this.operations.family(id, page, actor, own);
  }
  /**
   * Adds a relative within the current configured limit.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether the resource is restricted to the account-linked patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  addBeneficiary(id: string, input: BeneficiaryInput, actor: AccessActor, own = false) {
    this.require(actor, own ? "benefits:self" : "benefits:family-manage");
    return this.operations.addBeneficiary(id, this.familyInput(input), actor, own);
  }
  /**
   * Replaces a relative after the annual lock has elapsed.
   * @param id Resource identifier.
   * @param beneficiaryId Selected family member, or omitted for the holder.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether the resource is restricted to the account-linked patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  replaceBeneficiary(id: string, beneficiaryId: string, input: BeneficiaryInput, actor: AccessActor, own = false) {
    this.require(actor, own ? "benefits:self" : "benefits:family-manage");
    return this.operations.replaceBeneficiary(id, beneficiaryId, this.familyInput(input), actor, own);
  }
  /**
   * Reads global quota across clinics for the selected recipient.
   * @param id Resource identifier.
   * @param beneficiaryId Selected family member, or omitted for the holder.
   * @param page Bounded pagination values.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether the resource is restricted to the account-linked patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  balances(id: string, beneficiaryId: string | undefined, page: Pagination, actor: AccessActor, own = false) {
    this.require(actor, own ? "benefits:self" : "benefits:balances");
    return this.operations.balances(id, beneficiaryId, page, actor, own);
  }
  /**
   * Issues a short-lived owner presentation without reserving quota.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  issueTicket(id: string, input: TicketInput, actor: AccessActor) {
    this.require(actor, "benefits:self");
    this.units(input.units);
    return this.operations.issueTicket(id, input, actor);
  }
  /**
   * Records an authorized service against global quota.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  consume(input: ConsumptionInput, actor: AccessActor) {
    this.require(actor, "benefits:consume");
    this.units(input.units);
    return this.operations.consume(input, actor);
  }
  /**
   * Redeems the owner presentation in an authorized clinic.
   * @param input Validated operation fields.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  consumeTicket(input: TicketConsumptionInput, actor: AccessActor) {
    this.require(actor, "benefits:consume");
    return this.operations.consumeTicket(input, actor);
  }
  /**
   * Reverses a consumption in its original period with a mandatory reason.
   * @param id Resource identifier.
   * @param reason Required correction reason.
   * @param idempotencyKey Stable key for exactly this operation payload.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  reverse(id: string, reason: string, idempotencyKey: string, actor: AccessActor) {
    this.require(actor, "benefits:reverse");
    if (!reason.trim() || reason.trim().length > 500)
      throw new BadRequestException("A correction reason of 1 to 500 characters is required");
    return this.operations.reverse(id, reason.trim(), idempotencyKey, actor);
  }
  /**
   * Lists the authorized membership consumption history.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param actor Authenticated identity and current effective permissions.
   * @param own Whether the resource is restricted to the account-linked patient.
   * @returns The persisted result or completion of the authorized operation.
   */
  history(id: string, page: Pagination, actor: AccessActor, own = false) {
    this.require(actor, own ? "benefits:self" : "benefits:history");
    return this.operations.history(id, page, actor, own);
  }
  /**
   * Lists consumption evidence restricted to the authorized clinic.
   * @param id Resource identifier.
   * @param page Bounded pagination values.
   * @param actor Authenticated identity and current effective permissions.
   * @returns The persisted result or completion of the authorized operation.
   */
  clinicHistory(id: string, page: Pagination, actor: AccessActor) {
    this.require(actor, "benefits:history");
    return this.operations.clinicHistory(id, page, actor);
  }
  /**
   * Validates and coordinates the authorized benefit operation.
   * @param actor Authenticated identity and current effective permissions.
   * @param permission Explicit operation permission.
   */
  private require(actor: AccessActor, permission: Permission) {
    if (!AccessPolicy.allows(actor, permission)) throw new ForbiddenException("Benefit operation permission required");
  }
  /**
   * Validates and coordinates the authorized benefit operation.
   * @param value Optional civil birth date or integer units.
   */
  private units(value: number) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 1000)
      throw new BadRequestException("Units must be an integer from 1 to 1000");
  }
  /**
   * Validates and coordinates the authorized benefit operation.
   * @param input Validated operation fields.
   * @returns The persisted result or completion of the authorized operation.
   */
  private familyInput(input: BeneficiaryInput): BeneficiaryInput {
    const profile = personName(input.firstName, input.lastName);
    if (!profile) throw new BadRequestException("Invalid beneficiary name");
    if (!validBeneficiaryDate(input.birthDate)) throw new BadRequestException("Invalid beneficiary birth date");
    return { firstName: profile.firstName, lastName: profile.lastName, birthDate: input.birthDate ?? null };
  }
}

import { ForbiddenException, BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AccessPolicy, type AccessActor } from "../../authorization/domain/access-policy";
import {
  PreventionRepository,
  type EventInput,
  type EventQuery,
  type EventUpdate,
  type PreventionTypeInput
} from "../domain/prevention.repository";
import type { Pagination } from "../../../shared/domain/crud.repository";
/** Coordinates explicit operation permissions with patient-specific prevention. */
@Injectable()
export class PreventionUseCase {
  /**
   * Receives the explicit persistence and transport dependencies.
   * @param repository Persistence boundary.
   */
  constructor(private readonly repository: PreventionRepository) {}
  /**
   * Lists configured preventive event types.
   * @param page Bounded pagination values.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  types(page: Pagination, actor: AccessActor) {
    this.require(actor, "prevention:read");
    return this.repository.types(page);
  }
  /**
   * Saves a named preventive type without changing existing event snapshots.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  saveType(id: string | null, input: PreventionTypeInput, actor: AccessActor) {
    this.require(actor, "prevention:configure");
    return this.repository.saveType(id, input, actor);
  }
  /**
   * Creates a preventive event without consuming a benefit.
   * @param input Validated operation fields.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  create(input: EventInput, actor: AccessActor) {
    this.require(actor, "prevention:create");
    this.validate(input);
    return this.repository.create(input, actor);
  }
  /**
   * Reads the authorized preventive record.
   * @param id Resource identifier.
   * @param actor Authenticated caller and effective permissions.
   * @param own Whether the caller is restricted to its linked patient.
   * @returns The authorized result or completion of the operation.
   */
  async read(id: string, actor: AccessActor, own = false) {
    this.require(actor, own ? "prevention:self" : "prevention:read");
    const event = await this.repository.read(id, actor, own);
    if (!event) throw new NotFoundException("Preventive event not found");
    return event;
  }
  /**
   * Lists bounded records within the current ownership scope.
   * @param query Bounded explicit query filters.
   * @param actor Authenticated caller and effective permissions.
   * @param own Whether the caller is restricted to its linked patient.
   * @returns The authorized result or completion of the operation.
   */
  list(query: EventQuery, actor: AccessActor, own = false) {
    this.require(actor, own ? "prevention:self" : "prevention:read");
    if (query.from && query.to && new Date(query.from) >= new Date(query.to))
      throw new BadRequestException("Invalid time range");
    return this.repository.list(query, actor, own);
  }
  /**
   * Reschedules an open event using its expected version.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  update(id: string, input: EventUpdate, actor: AccessActor) {
    this.require(actor, "prevention:update");
    this.validate(input);
    return this.repository.update(id, input, actor);
  }
  /**
   * Records completion and calculates the next patient-specific event.
   * @param id Resource identifier.
   * @param expectedVersion Explicit expectedVersion value for this operation.
   * @param occurredAt Explicit occurredAt value for this operation.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  complete(id: string, expectedVersion: number, occurredAt: string, actor: AccessActor) {
    this.require(actor, "prevention:complete");
    return this.repository.complete(id, expectedVersion, occurredAt, actor);
  }
  /**
   * Closes the event and invalidates pending reminders.
   * @param id Resource identifier.
   * @param expectedVersion Explicit expectedVersion value for this operation.
   * @param actor Authenticated caller and effective permissions.
   * @returns The authorized result or completion of the operation.
   */
  cancel(id: string, expectedVersion: number, actor: AccessActor) {
    this.require(actor, "prevention:cancel");
    return this.repository.cancel(id, expectedVersion, actor);
  }
  /**
   * Processes a bounded durable batch without external calls in resource transactions.
   * @returns The authorized result or completion of the operation.
   */
  drain() {
    return this.repository.drain();
  }
  /**
   * Validates patient intervals and bounded unique reminder offsets.
   * @param input Validated operation fields.
   */
  private validate(input: EventInput | EventUpdate) {
    if (
      input.intervalMonths !== null &&
      (!Number.isInteger(input.intervalMonths) || input.intervalMonths < 1 || input.intervalMonths > 120)
    )
      throw new BadRequestException("Interval must be explicitly selected for this patient");
    if (
      input.reminderHours.length > 10 ||
      new Set(input.reminderHours).size !== input.reminderHours.length ||
      input.reminderHours.some(n => !Number.isInteger(n) || n < 1 || n > 8760)
    )
      throw new BadRequestException("Invalid reminder offsets");
  }
  /**
   * Requires the explicit operation permission.
   * @param actor Authenticated caller and effective permissions.
   * @param permission Explicit permission value for this operation.
   */
  private require(actor: AccessActor, permission: import("../../../shared/domain/permission").Permission) {
    if (!AccessPolicy.allows(actor, permission)) throw new ForbiddenException("Missing operation permission");
  }
}

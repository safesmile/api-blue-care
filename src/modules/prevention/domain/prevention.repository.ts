import type { AccessActor } from "../../authorization/domain/access-policy";
import type { Page, Pagination } from "../../../shared/domain/crud.repository";
export type PreventionStatus = "planned" | "scheduled" | "completed" | "cancelled";
export interface PreventionTypeInput {
  code: string;
  name: string;
  enabled: boolean;
}
export interface PreventionType extends PreventionTypeInput {
  id: string;
}
export interface EventInput {
  patientId: string;
  clinicId: string;
  typeId: string;
  dueAt: string;
  status: "planned" | "scheduled";
  intervalMonths: number | null;
  reminderHours: number[];
  externalReference?: string | null;
  idempotencyKey: string;
}
export interface EventUpdate {
  expectedVersion: number;
  dueAt: string;
  status: "planned" | "scheduled";
  intervalMonths: number | null;
  reminderHours: number[];
  externalReference?: string | null;
}
export interface EventQuery extends Pagination {
  patientId?: string;
  clinicId?: string;
  typeId?: string;
  status?: PreventionStatus;
  from?: string;
  to?: string;
}
export interface PreventionEvent {
  id: string;
  patientId: string;
  clinicId: string;
  typeId: string;
  typeName: string;
  dueAt: Date;
  status: PreventionStatus;
  intervalMonths: number | null;
  reminderHours: number[];
  version: number;
  externalReference: string | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  followUpOfId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
/** Persistence and resource ownership boundary for preventive tracking. */
export abstract class PreventionRepository {
  /**
   * Lists configured preventive event types.
   * @param page Bounded pagination values.
   */
  abstract types(page: Pagination): Promise<Page<PreventionType>>;
  /**
   * Saves a named preventive type without changing existing event snapshots.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated caller and effective permissions.
   */
  abstract saveType(id: string | null, input: PreventionTypeInput, actor: AccessActor): Promise<PreventionType>;
  /**
   * Creates a preventive event without consuming a benefit.
   * @param input Validated operation fields.
   * @param actor Authenticated caller and effective permissions.
   */
  abstract create(input: EventInput, actor: AccessActor): Promise<PreventionEvent>;
  /**
   * Reads the authorized preventive record.
   * @param id Resource identifier.
   * @param actor Authenticated caller and effective permissions.
   * @param own Whether the caller is restricted to its linked patient.
   */
  abstract read(id: string, actor: AccessActor, own: boolean): Promise<PreventionEvent | null>;
  /**
   * Lists bounded records within the current ownership scope.
   * @param query Bounded explicit query filters.
   * @param actor Authenticated caller and effective permissions.
   * @param own Whether the caller is restricted to its linked patient.
   */
  abstract list(query: EventQuery, actor: AccessActor, own: boolean): Promise<Page<PreventionEvent>>;
  /**
   * Reschedules an open event using its expected version.
   * @param id Resource identifier.
   * @param input Validated operation fields.
   * @param actor Authenticated caller and effective permissions.
   */
  abstract update(id: string, input: EventUpdate, actor: AccessActor): Promise<PreventionEvent>;
  /**
   * Records completion and calculates the next patient-specific event.
   * @param id Resource identifier.
   * @param expectedVersion Explicit expectedVersion value for this operation.
   * @param occurredAt Explicit occurredAt value for this operation.
   * @param actor Authenticated caller and effective permissions.
   */
  abstract complete(
    id: string,
    expectedVersion: number,
    occurredAt: string,
    actor: AccessActor
  ): Promise<{ event: PreventionEvent; next: PreventionEvent | null }>;
  /**
   * Closes the event and invalidates pending reminders.
   * @param id Resource identifier.
   * @param expectedVersion Explicit expectedVersion value for this operation.
   * @param actor Authenticated caller and effective permissions.
   */
  abstract cancel(id: string, expectedVersion: number, actor: AccessActor): Promise<PreventionEvent>;
  /**
   * Processes a bounded durable batch without external calls in resource transactions.
   */
  abstract drain(): Promise<{ generated: number }>;
}

import type { InvitationStatus } from "../domain/invitation.entity";
import { InvitationsRules } from "./invitationsRules.service";
import type { ClinicRoleAssignment } from "../../authorization/domain/clinic-context.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
import { RolesRepository } from "../../authorization/domain/roles.repository";
import { personName } from "../../../shared/domain/person-name";
import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { Invitation, type InvitationActor, type InvitationKind } from "../domain/invitation.entity";
import { InvitationRepository } from "../domain/invitation.repository";
import type { RoleName } from "../../../permissions";
import type { Pagination } from "../../../shared/domain/crud.repository";
import { CrudEntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";
interface CrudInvitationsUseCaseOperations {
  create: (
    input: CreateInvitationInput,
    actor: InvitationActor
  ) => Promise<{
    id: string;
    kind: InvitationKind;
    staff: boolean;
    patientId: string | null;
    clinicAssignments: ClinicRoleAssignment[];
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    invitedBy: string | null;
    invitedByName: string;
    invitedByEmail: string;
    createdAt: Date;
    expiresAt: Date;
    acceptedAt: Date | null;
    acceptedUserId: string | null;
    lastSendAttemptAt: Date | null;
    lastSentAt: Date | null;
    deliveryStatus: "pending" | "sent" | "failed";
    status: InvitationStatus;
  }>;
  list: (
    page: Pagination & { kind?: InvitationKind },
    actor?: AccessActor
  ) => Promise<{
    items: {
      id: string;
      kind: InvitationKind;
      staff: boolean;
      patientId: string | null;
      clinicAssignments: ClinicRoleAssignment[];
      email: string;
      firstName: string;
      lastName: string;
      roles: string[];
      invitedBy: string | null;
      invitedByName: string;
      invitedByEmail: string;
      createdAt: Date;
      expiresAt: Date;
      acceptedAt: Date | null;
      acceptedUserId: string | null;
      lastSendAttemptAt: Date | null;
      lastSentAt: Date | null;
      deliveryStatus: "pending" | "sent" | "failed";
      status: InvitationStatus;
    }[];
    total: number;
  }>;
}
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export interface CreateInvitationInput {
  kind?: InvitationKind;
  clinicAssignments?: ClinicRoleAssignment[];
  staff?: boolean;
  patientId?: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleName[];
}
/** Operaciones CRUD de Invitation. */
@Injectable()
export class CrudInvitationsUseCase extends CrudEntityUseCase<CrudInvitationsUseCaseOperations> {
  protected readonly asynchronousActions = ["create", "list"];

  protected readonly handlers = { create: this.createEntity.bind(this), list: this.listEntity.bind(this) };
  protected readonly policies: Partial<Record<keyof CrudInvitationsUseCaseOperations, OperationPolicy>> = {};

  /**
   * Recibe las dependencias de la operación.
   * @param invitations Dependencia tipada de invitations.
   * @param roles Dependencia tipada de roles.
   * @param rules Dependencia tipada de rules.
   */
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly roles: RolesRepository,
    private readonly rules: InvitationsRules
  ) {
    super();
  }
  /**
   *
   * @param input Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async createEntity(input: CreateInvitationInput, actor: InvitationActor) {
    if (input.kind === "patient") this.rules.authorizePatient(actor);
    else {
      this.rules.authorizeRoles(input.roles, actor);
      await this.roles.authorizeAssignment(input.roles, actor);
    }
    if (!personName(input.firstName, input.lastName))
      throw new BadRequestException("La longitud total del nombre no es válida");
    const token = randomBytes(40).toString("hex");
    const invitation = new Invitation({
      kind: input.kind ?? "general",
      staff: input.staff === true || !!input.clinicAssignments?.length,
      patientId: input.patientId ?? null,
      clinicAssignments: input.clinicAssignments ?? [],
      email: input.email.trim().toLowerCase(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      roles: input.roles,
      tokenHash: digest(token),
      invitedBy: actor.id,
      invitedByName: actor.name,
      invitedByEmail: actor.email,
      status: "pending",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      acceptedAt: null,
      acceptedUserId: null,
      lastSendAttemptAt: new Date(),
      lastSentAt: null,
      deliveryStatus: "pending"
    });
    await this.invitations.create(invitation, actor);
    await this.rules.deliver(invitation, token);
    return (await this.rules.requireInvitation(invitation.id)).toView();
  }
  /**
   *
   * @param page Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async listEntity(page: Pagination & { kind?: InvitationKind }, actor?: AccessActor) {
    const result = await this.invitations.list(page, actor);
    return { ...result, items: result.items.map(invitation => invitation.toView()) };
  }
}

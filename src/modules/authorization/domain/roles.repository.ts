import type { Permission, PermissionDefinition } from "../../../shared/domain/permission";
import type { Pagination } from "../../../shared/domain/crud.repository";
import type { AccessActor } from "./access-policy";
export interface RoleView {
  id: string;
  name: string;
  description: string;
  isProtected: boolean;
  permissions: Permission[];
}
export interface RoleInput {
  name: string;
  description: string;
  permissions: Permission[];
}
/** Role administration and assignment boundary; adapters enforce grant checks under row locks. */
export abstract class RolesRepository {
  abstract list(page: Pagination): Promise<{ items: RoleView[]; total: number }>;
  abstract read(id: string): Promise<RoleView | null>;
  abstract create(input: RoleInput, actor: AccessActor): Promise<RoleView>;
  abstract update(id: string, input: RoleInput, actor: AccessActor): Promise<RoleView>;
  abstract delete(id: string, actor: AccessActor): Promise<void>;
  abstract catalog(): Promise<PermissionDefinition[]>;
  abstract clinicAssignable(clinicId: string, actor: AccessActor): Promise<RoleView[]>;
  abstract authorizeAssignment(names: string[], actor: AccessActor): Promise<void>;
}

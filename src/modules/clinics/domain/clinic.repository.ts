import type { Page, Pagination } from "../../../shared/domain/crud.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
export const CLINIC_ICONS = ["clinic", "cross", "pin", "star", "grid", "layers"] as const;
export const CLINIC_COLORS = ["teal", "blue", "violet", "rose", "amber", "slate"] as const;
export type ClinicIcon = (typeof CLINIC_ICONS)[number];
export type ClinicColor = (typeof CLINIC_COLORS)[number];
export interface ClinicInput {
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  icon?: ClinicIcon;
  color?: ClinicColor;
}
export interface ClinicView extends ClinicInput {
  id: string;
  enabled: boolean;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
}
export interface ClinicQuery extends Pagination {
  search?: string;
  enabled?: boolean;
}
export interface ClinicStaffView {
  roles?: string[];
  name?: string;
  email?: string;
  userId: string;
  clinicId: string;
  createdAt: Date;
}
/** Clinic catalog and transactional staff access boundary. Clinics are deactivated, never erased. */
export abstract class ClinicRepository {
  abstract available(query: ClinicQuery, actor: AccessActor): Promise<Page<ClinicView>>;
  abstract create(input: ClinicInput, actor: AccessActor): Promise<ClinicView>;
  abstract read(id: string, actor: AccessActor): Promise<ClinicView | null>;
  abstract list(query: ClinicQuery, actor: AccessActor): Promise<Page<ClinicView>>;
  abstract update(
    id: string,
    input: Partial<ClinicInput> & { enabled?: boolean },
    actor: AccessActor
  ): Promise<ClinicView>;
  abstract staff(id: string, page: Pagination, actor: AccessActor): Promise<Page<ClinicStaffView>>;
  abstract assign(id: string, userId: string, actor: AccessActor, roles: string[]): Promise<void>;
  abstract unassign(id: string, userId: string, actor: AccessActor): Promise<void>;
}

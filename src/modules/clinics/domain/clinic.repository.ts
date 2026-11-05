import type { Page, Pagination } from "../../../shared/domain/crud.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
export interface ClinicInput {
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}
export interface ClinicView extends ClinicInput {
  id: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface ClinicQuery extends Pagination {
  search?: string;
  enabled?: boolean;
}
export interface ClinicStaffView {
  userId: string;
  clinicId: string;
  createdAt: Date;
}
/** Clinic catalog and transactional staff access boundary. Clinics are deactivated, never erased. */
export abstract class ClinicRepository {
  abstract create(input: ClinicInput, actor: AccessActor): Promise<ClinicView>;
  abstract read(id: string, actor: AccessActor): Promise<ClinicView | null>;
  abstract list(query: ClinicQuery, actor: AccessActor): Promise<Page<ClinicView>>;
  abstract update(
    id: string,
    input: Partial<ClinicInput> & { enabled?: boolean },
    actor: AccessActor
  ): Promise<ClinicView>;
  abstract staff(id: string, page: Pagination, actor: AccessActor): Promise<Page<ClinicStaffView>>;
  abstract assign(id: string, userId: string, actor: AccessActor): Promise<void>;
  abstract unassign(id: string, userId: string, actor: AccessActor): Promise<void>;
}

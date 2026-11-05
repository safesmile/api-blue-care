import type { Page, Pagination } from "../../../shared/domain/crud.repository";
import type { AccessActor } from "../../authorization/domain/access-policy";
export interface PatientInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  dpi?: string | null;
  birthDate?: string | null;
  address?: string | null;
}
export interface PatientView extends PatientInput {
  id: string;
  userId: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface PatientQuery extends Pagination {
  search?: string;
  enabled?: boolean;
  clinicId?: string;
}
/** Independent patient identity; account binding is an explicit verified-contact operation. */
export abstract class PatientRepository {
  abstract create(input: PatientInput & { clinicId: string }, actor: AccessActor): Promise<PatientView>;
  abstract read(id: string, actor: AccessActor): Promise<PatientView | null>;
  abstract own(userId: string): Promise<PatientView | null>;
  abstract list(query: PatientQuery, actor: AccessActor): Promise<Page<PatientView>>;
  abstract update(
    id: string,
    input: Partial<PatientInput> & { enabled?: boolean },
    actor: AccessActor
  ): Promise<PatientView>;
  abstract updateOwn(
    userId: string,
    input: Pick<PatientInput, "phone" | "birthDate" | "address">,
    actor: AccessActor
  ): Promise<PatientView>;
  abstract link(id: string, userId: string, actor: AccessActor): Promise<PatientView>;
  abstract associate(id: string, clinicId: string, actor: AccessActor): Promise<void>;
  abstract dissociate(id: string, clinicId: string, actor: AccessActor): Promise<void>;
  abstract clinics(id: string, actor: AccessActor): Promise<string[]>;
}

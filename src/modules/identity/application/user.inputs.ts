import { type RoleName } from "../../../permissions";
export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  roles: RoleName[];
}
export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  roles?: RoleName[];
}

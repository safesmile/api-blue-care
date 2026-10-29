import { type RoleName } from "../../../permissions";
export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  roles: RoleName[];
}
export interface UpdateUserInput {
  name?: string;
  enabled?: boolean;
  roles?: RoleName[];
}

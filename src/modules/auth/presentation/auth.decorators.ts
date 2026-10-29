import { SetMetadata } from "@nestjs/common";
import type { Permission } from "../../identity/domain/user";
export const Public = () => SetMetadata("public", true);
export const Permissions = (...permissions: Permission[]) => SetMetadata("permissions", permissions);

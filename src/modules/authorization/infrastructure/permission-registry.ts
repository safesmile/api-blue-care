import { IDENTITY_PERMISSION_DEFINITIONS } from "../../identity/domain/identity.permissions";
import { AUTH_PERMISSION_DEFINITIONS } from "../../auth/domain/auth.permissions";
// Registration belongs to synchronization infrastructure, never to role policy configuration.
export const REGISTERED_PERMISSIONS = [...IDENTITY_PERMISSION_DEFINITIONS, ...AUTH_PERMISSION_DEFINITIONS];

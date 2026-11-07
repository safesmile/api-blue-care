import { PermissionCode } from "../../../shared/domain/permission-code";
export const PREVENTION_PERMISSION_DEFINITIONS = [
  {
    shortcode: PermissionCode.PreventionRead,
    scope: "prevention.read",
    group: "Prevention",
    description: "read within the authorized prevention scope"
  },
  {
    shortcode: PermissionCode.PreventionConfigure,
    scope: "prevention.configure",
    group: "Prevention",
    description: "configure within the authorized prevention scope"
  },
  {
    shortcode: PermissionCode.PreventionCreate,
    scope: "prevention.create",
    group: "Prevention",
    description: "create within the authorized prevention scope"
  },
  {
    shortcode: PermissionCode.PreventionUpdate,
    scope: "prevention.update",
    group: "Prevention",
    description: "update within the authorized prevention scope"
  },
  {
    shortcode: PermissionCode.PreventionComplete,
    scope: "prevention.complete",
    group: "Prevention",
    description: "complete within the authorized prevention scope"
  },
  {
    shortcode: PermissionCode.PreventionCancel,
    scope: "prevention.cancel",
    group: "Prevention",
    description: "cancel within the authorized prevention scope"
  },
  {
    shortcode: PermissionCode.PreventionSelf,
    scope: "prevention.self",
    group: "Prevention",
    description: "self within the authorized prevention scope"
  }
] as const;

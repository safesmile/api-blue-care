import { PermissionCode } from "../../../shared/domain/permission-code";
export const DASHBOARD_PERMISSION_DEFINITIONS = [
  {
    shortcode: PermissionCode.DashboardRead,
    scope: "dashboard.read",
    group: "Dashboard",
    description: "read within the authorized dashboard scope"
  }
] as const;

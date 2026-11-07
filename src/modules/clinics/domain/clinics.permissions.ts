import { PermissionCode } from "../../../shared/domain/permission-code";
export const CLINICS_PERMISSION_DEFINITIONS = [
  {
    shortcode: PermissionCode.ClinicsCreate,
    scope: "clinics.create",
    group: "Clinics",
    description: "Create clinics with additional global scope"
  },
  {
    shortcode: PermissionCode.ClinicsRead,
    scope: "clinics.read",
    group: "Clinics",
    description: "Read clinic administrative details within assigned scope"
  },
  {
    shortcode: PermissionCode.ClinicsList,
    scope: "clinics.list",
    group: "Clinics",
    description: "List clinics within assigned scope"
  },
  {
    shortcode: PermissionCode.ClinicsUpdate,
    scope: "clinics.update",
    group: "Clinics",
    description: "Edit and deactivate clinics within assigned scope"
  },
  {
    shortcode: PermissionCode.ClinicsAll,
    scope: "clinics.all",
    group: "Clinics",
    description: "Operate across all clinics in addition to explicit operation permissions"
  },
  {
    shortcode: PermissionCode.ClinicsStaffList,
    scope: "clinics.staff-list",
    group: "Clinics",
    description: "Read staff assignments within clinic scope"
  },
  {
    shortcode: PermissionCode.ClinicsStaffManage,
    scope: "clinics.staff-manage",
    group: "Clinics",
    description: "Assign and remove clinic staff with additional global scope"
  }
] as const;

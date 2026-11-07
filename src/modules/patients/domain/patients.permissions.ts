import { PermissionCode } from "../../../shared/domain/permission-code";
export const PATIENTS_PERMISSION_DEFINITIONS = [
  {
    shortcode: PermissionCode.PatientsCreate,
    scope: "patients.create",
    group: "Patients",
    description: "Register patients in accessible active clinics"
  },
  {
    shortcode: PermissionCode.PatientsRead,
    scope: "patients.read",
    group: "Patients",
    description: "Read administrative patient records within clinic scope"
  },
  {
    shortcode: PermissionCode.PatientsList,
    scope: "patients.list",
    group: "Patients",
    description: "Search patient records within clinic scope"
  },
  {
    shortcode: PermissionCode.PatientsUpdate,
    scope: "patients.update",
    group: "Patients",
    description: "Edit or deactivate patient records within clinic scope"
  },
  {
    shortcode: PermissionCode.PatientsLink,
    scope: "patients.link",
    group: "Patients",
    description: "Link patients to verified matching accounts within clinic scope"
  },
  {
    shortcode: PermissionCode.PatientsSelf,
    scope: "patients.self",
    group: "Patients",
    description: "Read and complete the patient profile linked to your own account"
  }
] as const;

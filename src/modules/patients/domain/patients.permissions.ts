export const PATIENTS_PERMISSION_DEFINITIONS = [
  {
    shortcode: "patients:create",
    scope: "patients.create",
    group: "Patients",
    description: "Register patients in accessible active clinics"
  },
  {
    shortcode: "patients:read",
    scope: "patients.read",
    group: "Patients",
    description: "Read administrative patient records within clinic scope"
  },
  {
    shortcode: "patients:list",
    scope: "patients.list",
    group: "Patients",
    description: "Search patient records within clinic scope"
  },
  {
    shortcode: "patients:update",
    scope: "patients.update",
    group: "Patients",
    description: "Edit or deactivate patient records within clinic scope"
  },
  {
    shortcode: "patients:link",
    scope: "patients.link",
    group: "Patients",
    description: "Link patients to verified matching accounts within clinic scope"
  },
  {
    shortcode: "patients:self",
    scope: "patients.self",
    group: "Patients",
    description: "Read and complete the patient profile linked to your own account"
  }
] as const;

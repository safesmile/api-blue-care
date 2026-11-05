export const CLINICS_PERMISSION_DEFINITIONS = [
  {
    shortcode: "clinics:create",
    scope: "clinics.create",
    group: "Clinics",
    description: "Create clinics with additional global scope"
  },
  {
    shortcode: "clinics:read",
    scope: "clinics.read",
    group: "Clinics",
    description: "Read clinic administrative details within assigned scope"
  },
  {
    shortcode: "clinics:list",
    scope: "clinics.list",
    group: "Clinics",
    description: "List clinics within assigned scope"
  },
  {
    shortcode: "clinics:update",
    scope: "clinics.update",
    group: "Clinics",
    description: "Edit and deactivate clinics within assigned scope"
  },
  {
    shortcode: "clinics:all",
    scope: "clinics.all",
    group: "Clinics",
    description: "Operate across all clinics in addition to explicit operation permissions"
  },
  {
    shortcode: "clinics:staff-list",
    scope: "clinics.staff-list",
    group: "Clinics",
    description: "Read staff assignments within clinic scope"
  },
  {
    shortcode: "clinics:staff-manage",
    scope: "clinics.staff-manage",
    group: "Clinics",
    description: "Assign and remove clinic staff with additional global scope"
  }
] as const;

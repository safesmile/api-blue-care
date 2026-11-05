export const PREVENTION_PERMISSION_DEFINITIONS = [
  {
    shortcode: "prevention:read",
    scope: "prevention.read",
    group: "Prevention",
    description: "read within the authorized prevention scope"
  },
  {
    shortcode: "prevention:configure",
    scope: "prevention.configure",
    group: "Prevention",
    description: "configure within the authorized prevention scope"
  },
  {
    shortcode: "prevention:create",
    scope: "prevention.create",
    group: "Prevention",
    description: "create within the authorized prevention scope"
  },
  {
    shortcode: "prevention:update",
    scope: "prevention.update",
    group: "Prevention",
    description: "update within the authorized prevention scope"
  },
  {
    shortcode: "prevention:complete",
    scope: "prevention.complete",
    group: "Prevention",
    description: "complete within the authorized prevention scope"
  },
  {
    shortcode: "prevention:cancel",
    scope: "prevention.cancel",
    group: "Prevention",
    description: "cancel within the authorized prevention scope"
  },
  {
    shortcode: "prevention:self",
    scope: "prevention.self",
    group: "Prevention",
    description: "self within the authorized prevention scope"
  }
] as const;

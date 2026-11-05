export const BENEFITS_PERMISSION_DEFINITIONS = [
  {
    shortcode: "benefits:create",
    scope: "benefits.create",
    group: "Benefits",
    description: "create benefits within the explicit operation scope"
  },
  {
    shortcode: "benefits:read",
    scope: "benefits.read",
    group: "Benefits",
    description: "read benefits within the explicit operation scope"
  },
  {
    shortcode: "benefits:list",
    scope: "benefits.list",
    group: "Benefits",
    description: "list benefits within the explicit operation scope"
  },
  {
    shortcode: "benefits:version",
    scope: "benefits.version",
    group: "Benefits",
    description: "version benefits within the explicit operation scope"
  },
  {
    shortcode: "benefits:publish",
    scope: "benefits.publish",
    group: "Benefits",
    description: "publish benefits within the explicit operation scope"
  },
  {
    shortcode: "benefits:family-settings",
    scope: "benefits.family-settings",
    group: "Benefits",
    description: "family-settings benefits within the explicit operation scope"
  },
  {
    shortcode: "benefits:balances",
    scope: "benefits.balances",
    group: "Benefits",
    description: "balances benefits within the explicit operation scope"
  },
  {
    shortcode: "benefits:consume",
    scope: "benefits.consume",
    group: "Benefits",
    description: "consume benefits within the explicit operation scope"
  },
  {
    shortcode: "benefits:reverse",
    scope: "benefits.reverse",
    group: "Benefits",
    description: "reverse benefits within the explicit operation scope"
  },
  {
    shortcode: "benefits:history",
    scope: "benefits.history",
    group: "Benefits",
    description: "history benefits within the explicit operation scope"
  },
  {
    shortcode: "benefits:family-manage",
    scope: "benefits.family-manage",
    group: "Benefits",
    description: "family-manage benefits within the explicit operation scope"
  },
  {
    shortcode: "benefits:self",
    scope: "benefits.self",
    group: "Benefits",
    description: "Read own benefits and manage own family and presentation tickets"
  }
] as const;

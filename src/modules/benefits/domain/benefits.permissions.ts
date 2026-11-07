import { PermissionCode } from "../../../shared/domain/permission-code";
export const BENEFITS_PERMISSION_DEFINITIONS = [
  {
    shortcode: PermissionCode.BenefitsCreate,
    scope: "benefits.create",
    group: "Benefits",
    description: "create benefits within the explicit operation scope"
  },
  {
    shortcode: PermissionCode.BenefitsRead,
    scope: "benefits.read",
    group: "Benefits",
    description: "read benefits within the explicit operation scope"
  },
  {
    shortcode: PermissionCode.BenefitsList,
    scope: "benefits.list",
    group: "Benefits",
    description: "list benefits within the explicit operation scope"
  },
  {
    shortcode: PermissionCode.BenefitsVersion,
    scope: "benefits.version",
    group: "Benefits",
    description: "version benefits within the explicit operation scope"
  },
  {
    shortcode: PermissionCode.BenefitsPublish,
    scope: "benefits.publish",
    group: "Benefits",
    description: "publish benefits within the explicit operation scope"
  },
  {
    shortcode: PermissionCode.BenefitsFamilySettings,
    scope: "benefits.family-settings",
    group: "Benefits",
    description: "family-settings benefits within the explicit operation scope"
  },
  {
    shortcode: PermissionCode.BenefitsBalances,
    scope: "benefits.balances",
    group: "Benefits",
    description: "balances benefits within the explicit operation scope"
  },
  {
    shortcode: PermissionCode.BenefitsConsume,
    scope: "benefits.consume",
    group: "Benefits",
    description: "consume benefits within the explicit operation scope"
  },
  {
    shortcode: PermissionCode.BenefitsReverse,
    scope: "benefits.reverse",
    group: "Benefits",
    description: "reverse benefits within the explicit operation scope"
  },
  {
    shortcode: PermissionCode.BenefitsHistory,
    scope: "benefits.history",
    group: "Benefits",
    description: "history benefits within the explicit operation scope"
  },
  {
    shortcode: PermissionCode.BenefitsFamilyManage,
    scope: "benefits.family-manage",
    group: "Benefits",
    description: "family-manage benefits within the explicit operation scope"
  },
  {
    shortcode: PermissionCode.BenefitsSelf,
    scope: "benefits.self",
    group: "Benefits",
    description: "Read own benefits and manage own family and presentation tickets"
  }
] as const;

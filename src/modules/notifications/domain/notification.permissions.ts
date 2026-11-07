import { PermissionCode } from "../../../shared/domain/permission-code";
export const NOTIFICATION_PERMISSIONS = {
  devices: {
    shortcode: PermissionCode.NotificationsDevices,
    scope: "notifications.devices",
    group: "notifications",
    description: "Manage own push devices"
  },
  inbox: {
    shortcode: PermissionCode.NotificationsInbox,
    scope: "notifications.inbox.list",
    group: "notifications",
    description: "Read own notifications"
  },
  read: {
    shortcode: PermissionCode.NotificationsRead,
    scope: "notifications.inbox.markRead",
    group: "notifications",
    description: "Mark own notification read"
  }
} as const;
export const NOTIFICATION_PERMISSION_DEFINITIONS = Object.values(NOTIFICATION_PERMISSIONS);

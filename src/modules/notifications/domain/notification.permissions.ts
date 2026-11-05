export const NOTIFICATION_PERMISSIONS = {
  devices: {
    shortcode: "notifications:devices",
    scope: "notifications.devices",
    group: "notifications",
    description: "Manage own push devices"
  },
  inbox: {
    shortcode: "notifications:inbox",
    scope: "notifications.inbox.list",
    group: "notifications",
    description: "Read own notifications"
  },
  read: {
    shortcode: "notifications:read",
    scope: "notifications.inbox.markRead",
    group: "notifications",
    description: "Mark own notification read"
  }
} as const;
export const NOTIFICATION_PERMISSION_DEFINITIONS = Object.values(NOTIFICATION_PERMISSIONS);

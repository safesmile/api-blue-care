export const PUBLIC_USE_CASES = {
  previewInvitation: { limit: 20, ttl: 60000 },
  activation: { limit: 5, ttl: 60000 },
  login: { limit: 10, ttl: 60000 },
  refresh: { limit: 30, ttl: 60000 },
  logout: { limit: 30, ttl: 60000 },
  acceptInvitation: { limit: 10, ttl: 60000 },
  forgotPassword: { limit: 5, ttl: 60000 },
  resetPassword: { limit: 10, ttl: 60000 }
} as const;

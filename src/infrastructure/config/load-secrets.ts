import "dotenv/config";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
// Optional JSON secret, injected before Nest configuration is evaluated. Explicit env wins.
/**
 * Loads optional JSON configuration from Secret Manager before Nest starts.
 */
export async function loadSecrets() {
  if (!process.env.GCP_CONFIG_SECRET) return;
  const [version] = await new SecretManagerServiceClient().accessSecretVersion({
    name: process.env.GCP_CONFIG_SECRET
  });
  const values: unknown = JSON.parse(version.payload?.data?.toString() ?? "{}");
  if (!values || Array.isArray(values) || typeof values !== "object") throw new Error("Secret must be a JSON object");
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== "string") throw new Error("Secret values must be strings");
    process.env[key] ??= value;
  }
}

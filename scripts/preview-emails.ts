import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { buildAccountEmail } from "../src/modules/auth/infrastructure/emails/account-email";
import { emailText, renderEmailLayout } from "../src/infrastructure/email/email-layout";
import type { EmailContent } from "../src/shared/domain/email-sender";
/** Writes reviewable HTML/text samples without loading environment secrets, a database or any mail transport. */
function main() {
  const directory = resolve("docs/email-previews");
  mkdirSync(directory, { recursive: true });
  const paths = {
    reset: ["reset-password", "/reset-password"],
    activate: ["activate-account", "/activate-account"],
    "email-change": ["confirm-email", "/confirm-email"],
    invite: ["invitation", "/accept-invitation"]
  } as const;
  const branding = { appName: "Blue Care", primaryColor: "#1469b8" };
  for (const kind of ["reset", "activate", "email-change", "invite"] as const) {
    const [name, path] = paths[kind];
    const context =
      kind === "invite"
        ? {
            firstName: "Ana",
            lastName: "López",
            invitedByName: "Recepción Blue Care",
            expiresAt: new Date("2030-01-16T16:00:00Z")
          }
        : undefined;
    const message = buildAccountEmail(
      branding.appName,
      kind,
      "https://blue-care.example" + path + "?token=vista-previa-sin-validez",
      context
    );
    writeFileSync(join(directory, name + ".html"), renderEmailLayout(branding, message.content), "utf8");
    writeFileSync(join(directory, name + ".txt"), message.text, "utf8");
  }
  const content: EmailContent = {
    title: "Recordatorio Blue Care",
    preheader: "Tienes un evento preventivo próximo.",
    paragraphs: ["Tienes un evento preventivo próximo. Consulta la fecha y los detalles en Blue Care."],
    action: { label: "Abrir Blue Care", url: "https://blue-care.example" }
  };
  writeFileSync(join(directory, "notification.html"), renderEmailLayout(branding, content), "utf8");
  writeFileSync(join(directory, "notification.txt"), emailText(content), "utf8");
  console.info("Email previews generated in docs/email-previews. No email was sent.");
}
main();

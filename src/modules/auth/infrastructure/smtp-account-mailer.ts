import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport } from "nodemailer";
import { AccountMailer, type AccountActionKind, type MailContext } from "../domain/account-actions.repository";
/**
 * Delivers invitation and recovery links using SMTP.
 */
@Injectable()
export class SmtpAccountMailer extends AccountMailer {
  /**
   * Receives the dependencies required by this component.
   * @param config Validated application configuration.
   */
  constructor(private readonly config: ConfigService) {
    super();
  }
  /**
   * Delivers the account action link to its recipient.
   * @param email Account email address.
   * @param kind Account action to authorize.
   * @param token Opaque one-use credential supplied by the caller.
   * @param context Invitation identity and expiry metadata.
   */
  async send(email: string, kind: AccountActionKind | "invite", token: string, context?: MailContext) {
    const host = this.config.get<string>("SMTP_HOST");
    const from = this.config.get<string>("EMAIL_FROM");
    if (!host || !from) throw new ServiceUnavailableException("Email is not configured");
    const port = Number(this.config.get("SMTP_PORT") || 587);
    const transport = createTransport({
      host,
      port,
      secure: port === 465,
      auth: this.config.get("SMTP_USER")
        ? {
            user: this.config.get<string>("SMTP_USER"),
            pass: this.config.get<string>("SMTP_PASSWORD")
          }
        : undefined
    });
    const paths = {
      invite: "/accept-invitation",
      reset: "/reset-password",
      activate: "/activate-account",
      "email-change": "/confirm-email"
    };
    const subjects = {
      invite: "Has sido invitado a Blue Dent",
      reset: "Restablecer contraseña de Blue Dent",
      activate: "Activar tu cuenta de Blue Dent",
      "email-change": "Verificar tu nuevo email de Blue Dent"
    };
    const url = new URL(paths[kind], this.config.getOrThrow<string>("FRONTEND_URL"));
    url.searchParams.set("token", token);
    const intro = context
      ? "Hola " +
        context.firstName +
        " " +
        context.lastName +
        ". " +
        context.invitedByName +
        " te ha invitado a Blue Dent. La invitación vence el " +
        context.expiresAt.toISOString() +
        ". "
      : "Verifica el contacto de tu cuenta para continuar. ";
    await transport.sendMail({
      from,
      to: email,
      subject: subjects[kind],
      text: intro + "Abre este enlace para continuar: " + url.toString()
    });
  }
}

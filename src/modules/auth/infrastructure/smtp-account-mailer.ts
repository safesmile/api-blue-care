import { buildAccountEmail } from "./emails/account-email";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailSender } from "../../../shared/domain/email-sender";
import { AccountMailer, type AccountActionKind, type MailContext } from "../domain/account-actions.repository";
/**
 * Delivers invitation and recovery links using SMTP.
 */
@Injectable()
export class SmtpAccountMailer extends AccountMailer {
  /**
   * Receives the dependencies required by this component.
   * @param config Validated application configuration.
   * @param sender Shared email transport for account links.
   */
  constructor(
    private readonly config: ConfigService,
    private readonly sender: EmailSender
  ) {
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
    if (
      !this.config.get("EMAIL_FROM") ||
      (this.config.get("EMAIL_PROVIDER") === "sendgrid"
        ? !this.config.get("SENDGRID_API_KEY")
        : !this.config.get("SMTP_HOST"))
    )
      throw new ServiceUnavailableException("Email is not configured");
    const paths = {
      invite: "/accept-invitation",
      reset: "/reset-password",
      activate: "/activate-account",
      "email-change": "/confirm-email"
    };
    const url = new URL(paths[kind], this.config.getOrThrow<string>("FRONTEND_URL"));
    url.searchParams.set("token", token);
    const message = buildAccountEmail(
      this.config.get<string>("EMAIL_APP_NAME") || "Blue Care",
      kind,
      url.toString(),
      context
    );
    await this.sender.send({ to: email, ...message });
  }
}

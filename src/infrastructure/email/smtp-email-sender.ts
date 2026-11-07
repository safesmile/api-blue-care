import { emailWebUrl, renderEmailLayout } from "./email-layout";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport } from "nodemailer";
import { EmailSender, type EmailMessage } from "../../shared/domain/email-sender";
/** Delivers through Mailpit, custom SMTP or SendGrid's authenticated SMTP relay. */
@Injectable()
export class SmtpEmailSender extends EmailSender {
  /**
   * Recibe las dependencias de la operación.
   * @param config Dependencia tipada de config.
   */
  constructor(private readonly config: ConfigService) {
    super();
  }
  /**
   * Sends without logging addresses, message bodies or credentials.
   * @param message Email content and recipient.
   */
  async send(message: EmailMessage) {
    const sendgrid = this.config.get("EMAIL_PROVIDER") === "sendgrid";
    const host = sendgrid ? "smtp.sendgrid.net" : this.config.get<string>("SMTP_HOST");
    const from = this.config.get<string>("EMAIL_FROM");
    const password = sendgrid ? this.config.get<string>("SENDGRID_API_KEY") : this.config.get<string>("SMTP_PASSWORD");
    const user = sendgrid ? "apikey" : this.config.get<string>("SMTP_USER");
    if (!host || !from || (sendgrid && !password))
      throw new ServiceUnavailableException("El servicio de correo electrónico no está configurado");
    const port = sendgrid ? 587 : Number(this.config.get("SMTP_PORT") || 1025);
    const transport = createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: sendgrid || this.config.get("SMTP_REQUIRE_TLS") === "true",
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      auth: user ? { user, pass: password } : undefined
    });
    const { content, ...envelope } = message;
    const frontend = this.config.get<string>("FRONTEND_URL");
    const html =
      message.html ??
      renderEmailLayout(
        {
          appName: this.config.get<string>("EMAIL_APP_NAME") || "Blue Care",
          primaryColor: this.config.get<string>("EMAIL_PRIMARY_COLOR") || "#1469b8",
          logoUrl: this.config.get<string>("EMAIL_LOGO_URL") || undefined,
          supportEmail: this.config.get<string>("EMAIL_SUPPORT_EMAIL") || undefined
        },
        content ?? {
          title: message.subject,
          preheader: message.text.slice(0, 150),
          paragraphs: [message.text],
          ...(frontend ? { action: { label: "Abrir Blue Care", url: emailWebUrl(frontend) } } : {})
        }
      );
    await transport.sendMail({ ...envelope, html, from });
  }
}

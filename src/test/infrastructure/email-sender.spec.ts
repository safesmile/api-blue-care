import { ConfigService } from "@nestjs/config";
import { createTransport } from "nodemailer";
import { SmtpEmailSender } from "../../infrastructure/email/smtp-email-sender";
jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));
describe("Email transport", () => {
  const sendMail = jest.fn();
  beforeEach(() => {
    jest.resetAllMocks();
    (createTransport as jest.Mock).mockReturnValue({ sendMail });
  });
  it("targets the existing unauthenticated Mailpit and preserves provider failures", async () => {
    const sender = new SmtpEmailSender(
      new ConfigService({ SMTP_HOST: "localhost", SMTP_PORT: "1025", EMAIL_FROM: "no-reply@blue.test" })
    );
    await sender.send({ to: "a@blue.test", subject: "Test", text: "Body" });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "localhost", port: 1025, secure: false, auth: undefined })
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Body", html: expect.stringContaining("<h1") })
    );
    sendMail.mockRejectedValue(new Error("transport failed"));
    await expect(sender.send({ to: "a@blue.test", subject: "Test", text: "Body" })).rejects.toThrow("transport failed");
  });
  it("uses SendGrid API key authentication and mandatory STARTTLS", async () => {
    const sender = new SmtpEmailSender(
      new ConfigService({ EMAIL_PROVIDER: "sendgrid", SENDGRID_API_KEY: "test-key", EMAIL_FROM: "verified@blue.test" })
    );
    await sender.send({ to: "a@blue.test", subject: "Test", text: "Body" });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.sendgrid.net",
        port: 587,
        requireTLS: true,
        auth: { user: "apikey", pass: "test-key" }
      })
    );
    await expect(
      new SmtpEmailSender(new ConfigService({ EMAIL_PROVIDER: "sendgrid", EMAIL_FROM: "a@blue.test" })).send({
        to: "a@blue.test",
        subject: "Test",
        text: "Body"
      })
    ).rejects.toThrow("not configured");
  });
  it("brands durable plain notifications at delivery time and preserves explicit trusted HTML", async () => {
    const sender = new SmtpEmailSender(
      new ConfigService({
        SMTP_HOST: "localhost",
        EMAIL_FROM: "no-reply@blue.test",
        FRONTEND_URL: "http://localhost:5173",
        EMAIL_APP_NAME: "Blue Care",
        EMAIL_PRIMARY_COLOR: "#1469b8"
      })
    );
    await sender.send({
      to: "a@blue.test",
      subject: "Recordatorio",
      text: "Contenido <personal> & seguro",
      messageId: "<stable@blue.test>"
    });
    const message = sendMail.mock.calls[0][0];
    expect(message.html).toContain("Contenido &lt;personal&gt; &amp; seguro");
    expect(message.html).toContain('href="http://localhost:5173/"');
    expect(message.messageId).toBe("<stable@blue.test>");
    expect(message.text).toBe("Contenido <personal> & seguro");
    await sender.send({
      to: "a@blue.test",
      subject: "Custom",
      text: "Custom text",
      html: "<p>Trusted custom template</p>"
    });
    expect(sendMail.mock.calls[1][0].html).toBe("<p>Trusted custom template</p>");
  });
});

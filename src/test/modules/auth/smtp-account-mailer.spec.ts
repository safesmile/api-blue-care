import { ConfigService } from "@nestjs/config";
import { ServiceUnavailableException } from "@nestjs/common";
import { createTransport } from "nodemailer";
import { SmtpAccountMailer } from "../../../modules/auth/infrastructure/smtp-account-mailer";
jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));
describe("SMTP account links", () => {
  const sendMail = jest.fn().mockResolvedValue({});
  const settings = {
    SMTP_HOST: "localhost",
    EMAIL_FROM: "Blue Dent <no-reply@blue.test>",
    FRONTEND_URL: "http://localhost:5173"
  };
  beforeEach(() => {
    jest.clearAllMocks();
    (createTransport as jest.Mock).mockReturnValue({ sendMail });
  });
  it.each([
    ["invite", "/accept-invitation"],
    ["reset", "/reset-password"],
    ["activate", "/activate-account"],
    ["email-change", "/confirm-email"]
  ] as const)("sends a %s link containing a readable URL token", async (kind, path) => {
    const mail = new SmtpAccountMailer(new ConfigService(settings));
    await mail.send("invited@blue.test", kind, "a".repeat(80), {
      firstName: "Ana",
      lastName: "López",
      invitedByName: "Admin",
      expiresAt: new Date("2030-01-01T00:00:00Z")
    });
    const message = sendMail.mock.calls[0][0];
    expect(message.to).toBe("invited@blue.test");
    expect(message.text).toContain(path + "?token=" + "a".repeat(80));
    expect(message.text).toContain("Ana López");
  });
  it("uses SMTP authentication and implicit TLS when configured", async () => {
    const mail = new SmtpAccountMailer(
      new ConfigService({ ...settings, SMTP_PORT: 465, SMTP_USER: "user", SMTP_PASSWORD: "secret" })
    );
    await mail.send("a@blue.test", "reset", "token");
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ secure: true, auth: { user: "user", pass: "secret" } })
    );
  });
  it("rejects unavailable SMTP configuration", async () => {
    await expect(
      new SmtpAccountMailer(new ConfigService({})).send("a@blue.test", "reset", "token")
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

import { createTransport } from "nodemailer";
import { emailText, emailWebUrl, renderEmailLayout } from "../../infrastructure/email/email-layout";
import { buildAccountEmail } from "../../modules/auth/infrastructure/emails/account-email";
describe("Shared email layout and module content builders", () => {
  const branding = { appName: "Blue Care", primaryColor: "#1469b8" },
    url = "http://localhost:5173/reset-password?token=" + "a".repeat(80);
  it("builds a responsive complete HTML document and matching multipart text without a network connection", async () => {
    const message = buildAccountEmail(branding.appName, "reset", url);
    const html = renderEmailLayout(branding, message.content);
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('name="viewport"');
    expect(html).toContain("max-width:600px");
    expect(html).toContain('role="presentation"');
    expect(html).toContain('href="' + url + '"');
    expect(html).toContain("30 minutos");
    expect(message.text).toContain(url);
    expect(message.text).not.toContain("<table");
    expect(message.text).not.toContain("Verifica el contacto");
    const transport = createTransport({ streamTransport: true, buffer: true, newline: "unix" });
    const result = await transport.sendMail({
      from: "Blue Care <no-reply@blue.test>",
      to: "recipient@blue.test",
      subject: message.subject,
      text: message.text,
      html
    });
    const mime = result.message.toString();
    expect(mime).toContain("multipart/alternative");
    expect(mime).toContain("Content-Type: text/plain");
    expect(mime).toContain("Content-Type: text/html");
  });
  it("escapes all dynamic text, image attributes and action URLs instead of rendering supplied markup", () => {
    const message = buildAccountEmail("Blue <Care>", "invite", url + "&source=mail", {
      firstName: 'Ana <img src=x onerror="alert(1)">',
      lastName: "López & familia",
      invitedByName: "Admin <script>alert(1)</script>",
      expiresAt: new Date("2030-01-01T02:00:00Z")
    });
    const html = renderEmailLayout(
      {
        ...branding,
        appName: 'Blue "Care"',
        logoUrl: 'https://assets.example/logo.png?name="test"&size=2',
        supportEmail: "support@blue.example"
      },
      message.content
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
    expect(html).toContain("López &amp; familia");
    expect(html).toContain("&amp;source=mail");
    expect(html).toContain("%22test%22&amp;size=2");
    expect(html).toContain("Blue &quot;Care&quot;");
    expect(html).toContain("mailto:support@blue.example");
    expect(message.text).toContain("31 de diciembre de 2029");
    expect(message.text).toContain("hora de Guatemala");
  });
  it("validates link schemes and identity styles before rendering", () => {
    for (const unsafe of ["javascript:alert(1)", "data:text/html,x", "https://user:pass@example.com", "not a URL"])
      expect(() => emailWebUrl(unsafe)).toThrow("Invalid email web URL");
    const content = { title: "Title", preheader: "Preview", paragraphs: ["Hello"] };
    expect(() => renderEmailLayout({ ...branding, primaryColor: "red;background:url(x)" }, content)).toThrow(
      "primary color"
    );
    expect(() => renderEmailLayout({ ...branding, supportEmail: "bad\r\naddress" }, content)).toThrow("support");
    expect(() => renderEmailLayout({ ...branding, logoUrl: "javascript:alert(1)" }, content)).toThrow("web URL");
    expect(emailText(content)).toBe("Title\n\nHello");
    expect(renderEmailLayout(branding, content)).not.toContain("href=");
  });
  it.each(["reset", "activate", "email-change", "invite"] as const)(
    "provides distinct %s instructions and labels without marketing promises",
    kind => {
      const message = buildAccountEmail("Blue Care", kind, url);
      expect(message.subject).toContain("Blue Care:");
      expect(message.content.action?.url).toBe(url);
      expect(message.content.note).toContain("un solo uso");
      if (kind === "email-change") expect(message.text).toContain("hasta que confirmes");
      if (kind === "invite") expect(message.text).not.toContain("30 minutos");
    }
  );
});

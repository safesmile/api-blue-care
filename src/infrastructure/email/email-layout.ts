import type { EmailContent } from "../../shared/domain/email-sender";
export interface EmailBranding {
  appName: string;
  primaryColor: string;
  logoUrl?: string;
  supportEmail?: string;
}
/**
 * Escapes text for HTML text nodes and quoted attributes, never interpreting user HTML.
 * @param value Untrusted display text.
 * @returns Escaped HTML text.
 */
export function escapeEmailHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!
  );
}
/**
 * Allows only ordinary web links and excludes embedded credentials.
 * @param value Configured logo or action URL.
 * @returns The validated absolute URL.
 */
export function emailWebUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid email web URL");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Invalid email web URL");
  return url.toString();
}
/**
 * Converts structured content into a useful plain-text alternative.
 * @param content Typed message content.
 * @returns Human-readable text including the full action link.
 */
export function emailText(content: EmailContent): string {
  return [
    content.title,
    ...content.paragraphs,
    ...(content.action ? [content.action.label + ": " + content.action.url] : []),
    ...(content.note ? [content.note] : [])
  ].join("\n\n");
}
/**
 * Builds the shared Blue Care shell using presentation tables and inline styles.
 * @param branding Resolved visual identity without transport credentials.
 * @param content Typed message content; no raw HTML slots are accepted.
 * @returns A complete HTML email document.
 */
export function renderEmailLayout(branding: EmailBranding, content: EmailContent): string {
  if (!/^#[a-f0-9]{6}$/i.test(branding.primaryColor)) throw new Error("Invalid email primary color");
  if (branding.supportEmail && !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(branding.supportEmail))
    throw new Error("Invalid email support address");
  const escape = escapeEmailHtml;
  const logo = branding.logoUrl
    ? `<img src="${escape(emailWebUrl(branding.logoUrl))}" alt="${escape(branding.appName)}" height="36" style="display:block;border:0;max-width:220px;height:36px;">`
    : `<span style="font-size:23px;font-weight:700;letter-spacing:-0.6px;color:#123a58;">${escape(branding.appName)}</span>`;
  const paragraphs = content.paragraphs
    .map(
      paragraph =>
        `<p style="margin:0 0 18px;font-size:16px;line-height:26px;color:#455b6c;">${escape(paragraph).replace(/\r\n|\n|\r/g, "<br>")}</p>`
    )
    .join("");
  const action = content.action ? emailWebUrl(content.action.url) : null;
  const button =
    action && content.action
      ? `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr>
      <td bgcolor="${branding.primaryColor}" style="border-radius:8px;background-color:${branding.primaryColor};text-align:center;">
        <a href="${escape(action)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;
          border:1px solid ${branding.primaryColor};
          border-radius:8px;
          padding:15px 24px;
          font-family:Arial,Helvetica,sans-serif;
          font-size:15px;
          font-weight:700;
          line-height:20px;
          text-decoration:none;
          color:#ffffff;
          background-color:${branding.primaryColor};
          mso-padding-alt:0;
          ">${escape(content.action.label)}</a>
      </td></tr></table>
    <p style="margin:0 0 8px;font-size:12px;line-height:20px;color:#647788;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
    <p style="margin:0 0 24px;
          font-size:12px;
          line-height:20px;
          word-break:break-all;
          overflow-wrap:anywhere;
          ">
      <a href="${escape(action)}" style="color:${branding.primaryColor};
          text-decoration:underline;
          word-break:break-all;
          ">${escape(action)}</a>
      </p>`
      : "";
  const note = content.note
    ? `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
      <tr>
      <td bgcolor="#edf6fb" style="padding:16px 18px;
          border-left:3px solid ${branding.primaryColor};
          border-radius:4px;
          font-size:13px;
          line-height:21px;
          color:#455b6c;
          ">${escape(content.note)}</td>
      </tr>
      </table>`
    : "";
  const support = branding.supportEmail
    ? `<br>¿Necesitas ayuda? <a href="mailto:${escape(branding.supportEmail)}" style="color:${branding.primaryColor};text-decoration:underline;">${escape(branding.supportEmail)}</a>`
    : "";
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(content.title)}</title></head>
<body style="margin:0;padding:0;background-color:#eef4f8;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;color:#eef4f8;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escape(content.preheader)}</div>
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#eef4f8" style="width:100%;background-color:#eef4f8;"><tr><td align="center" style="padding:32px 12px;">
    <!--[if mso]><table role="presentation" width="600" border="0" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;
          max-width:600px;
          background-color:#ffffff;
          border:1px solid #dce7ef;
          border-radius:12px;
          ">
      <tr><td style="height:5px;background-color:${branding.primaryColor};border-radius:12px 12px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr>
      <td style="padding:28px 28px 24px;
          border-bottom:1px solid #e7eef3;
          ">${logo}<p style="margin:7px 0 0;
          color:#6a8090;
          font-size:11px;
          line-height:16px;
          letter-spacing:1.8px;
          ">CONTIGO EN CADA SONRISA</p>
      </td>
      </tr>
      <tr>
      <td style="padding:32px 28px;
          ">
      <h1 style="margin:0 0 22px;
          color:#123a58;
          font-size:27px;
          line-height:35px;
          font-weight:700;
          letter-spacing:-0.5px;
          ">${escape(content.title)}</h1>${paragraphs}${button}${note}</td>
      </tr>
      <tr>
      <td bgcolor="#f8fbfd" style="padding:22px 28px;
          border-top:1px solid #e7eef3;
          border-radius:0 0 12px 12px;
          color:#738592;
          font-size:12px;
          line-height:20px;
          ">Este es un mensaje automático de ${escape(branding.appName)}.${support}</td>
      </tr>
    </table>
    <!--[if mso]></td></tr></table><![endif]-->
    <p style="margin:18px 0 0;color:#738592;font-size:11px;line-height:18px;">${escape(branding.appName)} · Blue Dental</p>
  </td></tr></table>
</body></html>`;
}

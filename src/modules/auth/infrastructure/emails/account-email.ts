import type { EmailContent } from "../../../../shared/domain/email-sender";
import type { AccountActionKind, MailContext } from "../../domain/account-actions.repository";
import { emailText } from "../../../../infrastructure/email/email-layout";
/**
 * Builds action-specific content independently of the delivery provider and shared layout.
 * @param appName Configured public product name.
 * @param kind One-use account action.
 * @param url Complete frontend action URL containing the one-use token.
 * @param context Optional invitation identity and real expiration.
 * @returns Subject, structured content and the matching text alternative.
 */
export function buildAccountEmail(
  appName: string,
  kind: AccountActionKind | "invite",
  url: string,
  context?: MailContext
) {
  const copy = {
    reset: {
      title: "Restablece tu contraseña",
      preview: "Elige una nueva contraseña para tu cuenta.",
      body: "Recibimos una solicitud para restablecer la contraseña de tu cuenta. Usa el siguiente botón para elegir una nueva.",
      label: "Restablecer mi contraseña",
      note: "Este enlace es de un solo uso y vence en 30 minutos. Si no solicitaste este cambio, puedes ignorar este correo; tu contraseña seguirá siendo la misma."
    },
    activate: {
      title: "Activa tu cuenta",
      preview: "Tu acceso a Blue Care comienza aquí.",
      body: "Tu cuenta está lista para activarse. Verifica tu correo electrónico y establece tu contraseña para comenzar.",
      label: "Activar mi cuenta",
      note: "Este enlace es de un solo uso y vence en 30 minutos. Si no reconoces esta solicitud, puedes ignorar este correo."
    },
    "email-change": {
      title: "Confirma tu nuevo correo",
      preview: "Verifica el nuevo correo de tu cuenta.",
      body: "Recibimos una solicitud para utilizar esta dirección como el nuevo correo de tu cuenta. Confírmala con el siguiente botón.",
      label: "Confirmar mi correo",
      note: "Este enlace es de un solo uso y vence en 30 minutos. Tu dirección actual se conservará hasta que confirmes el cambio. Si no lo solicitaste, ignora este correo."
    },
    invite: {
      title: "Te damos la bienvenida",
      preview: "Tienes una invitación para crear tu cuenta.",
      body: "Te invitamos a crear tu cuenta para consultar tu información y acceder a los servicios disponibles.",
      label: "Aceptar invitación",
      note: "Esta invitación es personal y su enlace es de un solo uso. Si no esperabas este correo, puedes ignorarlo."
    }
  }[kind];
  const paragraphs: string[] = [];
  if (context) paragraphs.push("Hola " + context.firstName + " " + context.lastName + ".");
  if (kind === "invite" && context) paragraphs.push(context.invitedByName + " te ha invitado a " + appName + ".");
  paragraphs.push(copy.body);
  if (kind === "invite" && context)
    paragraphs.push(
      "La invitación vence el " +
        new Intl.DateTimeFormat("es-GT", {
          timeZone: "America/Guatemala",
          dateStyle: "long",
          timeStyle: "short"
        }).format(context.expiresAt) +
        " (hora de Guatemala)."
    );
  const content: EmailContent = {
    title: copy.title,
    preheader: copy.preview,
    paragraphs,
    action: { label: copy.label, url },
    note: copy.note
  };
  return { subject: appName + ": " + copy.title, content, text: emailText(content) };
}

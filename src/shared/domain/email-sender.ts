/** Structured content rendered by infrastructure; dynamic values are always escaped. */
export interface EmailContent {
  title: string;
  preheader: string;
  paragraphs: readonly string[];
  action?: { label: string; url: string };
  note?: string;
}
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  content?: EmailContent;
  messageId?: string;
}
/** Shared transport port for account and business emails. */
export abstract class EmailSender {
  abstract send(message: EmailMessage): Promise<void>;
}

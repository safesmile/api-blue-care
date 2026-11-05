import { Module } from "@nestjs/common";
import { EmailSender } from "../../shared/domain/email-sender";
import { SmtpEmailSender } from "./smtp-email-sender";
/** Shares one email transport contract across modules. */
@Module({ providers: [{ provide: EmailSender, useClass: SmtpEmailSender }], exports: [EmailSender] })
export class EmailModule {}

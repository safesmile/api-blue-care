import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
import { Transform } from "class-transformer";
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsString,
  IsUUID,
  ValidateIf,
  Length,
  Matches,
  MaxLength
} from "class-validator";
import { type RoleName } from "../../../permissions";
/**
 * Defines and validates the HTTP input fields.
 */
export class CreateInvitationDto extends AuditReasonDto {
  @ValidateIf((_o, value) => value !== undefined) @IsUUID() patientId?: string;
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  firstName!: string;
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  lastName!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @Matches(/^[a-z][a-z0-9-]{1,59}$/, { each: true })
  roles!: RoleName[];
}
/**
 * Defines and validates the HTTP input fields.
 */
export class InvitationTokenDto {
  @IsString() @Length(80, 80) @Matches(/^[a-f0-9]+$/) token!: string;
}
/**
 * Defines and validates the HTTP input fields.
 */
export class AcceptInvitationDto extends InvitationTokenDto {
  @IsString() @Length(8, 72) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])\S+$/) password!: string;
}

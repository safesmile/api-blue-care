import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf
} from "class-validator";
import { AuditReasonDto } from "../../../shared/presentation/audit-reason.dto";
/** Validates patient creation in a known clinic. */
export class CreatePatientDto extends AuditReasonDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  firstName!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  lastName!: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 500)
  address?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/^[+0-9() .-]{5,30}$/)
  phone?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  @Length(1, 254)
  email?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/^\d{13}$/)
  dpi?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birthDate?: string | null;
  @IsUUID() clinicId!: string;
}
/** Validates explicit profile or status changes. */
export class UpdatePatientDto extends AuditReasonDto {
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  firstName?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  lastName?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 500)
  address?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/^[+0-9() .-]{5,30}$/)
  phone?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  @Length(1, 254)
  email?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/^\d{13}$/)
  dpi?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birthDate?: string | null;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() enabled?: boolean;
}
/** Restricts lists to bounded, explicit filters. */
export class PatientQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @Type(() => Number) @IsInt() @Min(0) offset = 0;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  search?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(({ value }) => (value === "true" ? true : value === "false" ? false : value))
  @IsBoolean()
  enabled?: boolean;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() clinicId?: string;
}
/** Only non-verifying contact/profile fields are editable by the account owner. */
export class OwnPatientDto extends AuditReasonDto {
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 500)
  address?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/^[+0-9() .-]{5,30}$/)
  phone?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birthDate?: string | null;
}
/** Selects a verified account; the server verifies contact equality under lock. */
export class LinkPatientDto extends AuditReasonDto {
  @IsUUID() userId!: string;
}
